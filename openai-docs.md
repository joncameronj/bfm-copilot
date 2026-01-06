# OpenAI Responses API Reference

This document consolidates key information from OpenAI's documentation for implementing the Responses API with function calling and streaming.

## Table of Contents
1. [Responses API vs Chat Completions](#responses-api-vs-chat-completions)
2. [Tool/Function Definition Format](#toolfunction-definition-format)
3. [Streaming Events](#streaming-events)
4. [Function Calling with Streaming](#function-calling-with-streaming)
5. [Submitting Function Outputs](#submitting-function-outputs)
6. [Common Errors and Solutions](#common-errors-and-solutions)
7. [Best Practices](#best-practices)

---

## Responses API vs Chat Completions

### Key Structural Differences

| Aspect | Chat Completions | Responses API |
|--------|------------------|---------------|
| Input format | Array of Messages | Array of Items |
| Tool calls | Part of message | Separate Item type |
| Tool outputs | `tool` role message | `function_call_output` Item |
| State management | Manual message history | `previous_response_id` chaining |
| Built-in tools | Not available | `web_search`, `file_search`, `code_interpreter` |

### Items vs Messages

In Responses API, a message is a **type of Item**. Other Item types include:
- `function_call` - Model requests to call a function
- `function_call_output` - Your response to a function call
- `message` - User or assistant text

---

## Tool/Function Definition Format

### Responses API Format (Flat)

```python
tools = [
    {
        "type": "function",
        "name": "search_knowledge_base",
        "description": "Search the knowledge base for relevant information",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query"
                }
            },
            "required": ["query"],
            "additionalProperties": False
        },
        "strict": True  # Optional: enables structured outputs
    }
]
```

### Chat Completions Format (Nested) - DO NOT USE WITH RESPONSES API

```python
# This format causes "Missing required parameter: 'tools[0].function'" error
tools = [
    {
        "type": "function",
        "function": {  # <-- This nesting is WRONG for Responses API
            "name": "search_knowledge_base",
            ...
        }
    }
]
```

---

## Streaming Events

### Event Structure

Each SSE event has two lines followed by blank:
```
event: response.output_text.delta
data: {"type": "response.output_text.delta", "delta": "Hello", ...}

```

### Core Event Types

#### Response Lifecycle
| Event | Description |
|-------|-------------|
| `response.created` | Response initialized, contains `response.id` |
| `response.in_progress` | Generation ongoing |
| `response.completed` | Success (includes token usage) |
| `response.incomplete` | Early termination |
| `response.failed` | Generation error |

#### Text Streaming
| Event | Description |
|-------|-------------|
| `response.output_item.added` | New output item created |
| `response.output_text.delta` | Partial text chunk |
| `response.output_text.done` | Final complete text |

#### Function Calling
| Event | Description |
|-------|-------------|
| `response.output_item.added` | Function call item created (type="function_call") |
| `response.function_call_arguments.delta` | JSON arguments streaming |
| `response.function_call_arguments.done` | Complete arguments ready |

#### Reasoning (for reasoning models like o1, o3, gpt-5)
| Event | Description |
|-------|-------------|
| `response.reasoning_text.delta` | Reasoning text streaming |
| `response.reasoning_text.done` | Reasoning complete |
| `response.reasoning_summary_text.delta` | Summary streaming |
| `response.reasoning_summary_text.done` | Summary complete |

### Key Event Data Fields

```python
# response.output_item.added (function_call)
{
    "type": "response.output_item.added",
    "output_index": 0,
    "item": {
        "type": "function_call",
        "id": "fc_abc123",           # Item ID
        "call_id": "call_xyz789",    # USE THIS for function output
        "name": "search_knowledge_base",
        "arguments": ""
    }
}

# response.function_call_arguments.done
{
    "type": "response.function_call_arguments.done",
    "item_id": "fc_abc123",
    "output_index": 0,
    "arguments": "{\"query\": \"example search\"}"
}
```

**CRITICAL:** Use `call_id` from the item (not `id`) when submitting function outputs.

---

## Function Calling with Streaming

### Complete Flow

```python
from openai import OpenAI
import json

client = OpenAI()

def handle_streaming_with_tools(messages, tools):
    """Handle streaming response with function calling."""

    # Initial request
    response = client.responses.create(
        model="gpt-5",
        input=messages,
        tools=tools,
        reasoning={"effort": "high", "summary": "detailed"},
        stream=True
    )

    response_id = None
    pending_tool_calls = {}  # call_id -> {name, arguments}

    for event in response:
        if event.type == "response.created":
            response_id = event.response.id

        elif event.type == "response.output_item.added":
            item = event.item
            if item.type == "function_call":
                # Store the call_id (NOT item.id)
                pending_tool_calls[item.call_id] = {
                    "name": item.name,
                    "arguments": ""
                }

        elif event.type == "response.function_call_arguments.delta":
            # Find which call this belongs to by item_id
            item_id = event.item_id
            # Arguments accumulate via delta
            for call_id, info in pending_tool_calls.items():
                if not info.get("complete"):
                    info["arguments"] += event.delta
                    break

        elif event.type == "response.function_call_arguments.done":
            # Mark as complete with final arguments
            for call_id, info in pending_tool_calls.items():
                if not info.get("complete"):
                    info["arguments"] = event.arguments  # Use final version
                    info["complete"] = True
                    break

        elif event.type == "response.output_text.delta":
            # Stream text to user
            print(event.delta, end="", flush=True)

        elif event.type == "response.completed":
            break

    return response_id, pending_tool_calls
```

---

## Submitting Function Outputs

### Method 1: Using `previous_response_id` (Recommended)

When continuing from a previous response that had function calls:

```python
# Execute tools and collect outputs
tool_outputs = []
for call_id, info in pending_tool_calls.items():
    args = json.loads(info["arguments"])
    result = execute_my_function(info["name"], args)

    tool_outputs.append({
        "type": "function_call_output",
        "call_id": call_id,  # MUST match the call_id from function call
        "output": result
    })

# Continue the response
response = client.responses.create(
    model="gpt-5",
    previous_response_id=response_id,  # Chain to previous
    input=tool_outputs,  # Only the outputs, not full history
    tools=tools,
    stream=True
)
```

### Method 2: Full History (Without `previous_response_id`)

If NOT using `previous_response_id`, you must include BOTH the function_call AND function_call_output:

```python
# Must include both the call AND the output with matching call_id
input_items = [
    *messages,  # Original conversation
    {
        "type": "function_call",
        "call_id": "call_xyz789",
        "name": "search_knowledge_base",
        "arguments": "{\"query\": \"example\"}"
    },
    {
        "type": "function_call_output",
        "call_id": "call_xyz789",  # Must match!
        "output": "Search results here..."
    }
]

response = client.responses.create(
    model="gpt-5",
    input=input_items,
    tools=tools,
    stream=True
)
```

---

## Common Errors and Solutions

### Error: "No tool output found for function call"

**Causes:**
1. `call_id` mismatch between function_call and function_call_output
2. Using `item.id` instead of `item.call_id`
3. Missing `previous_response_id` when only sending outputs
4. Race condition with parallel tool calls

**Solutions:**
```python
# 1. Always use call_id from the item
call_id = item.call_id  # Correct
call_id = item.id       # WRONG

# 2. Disable parallel tool calls if having issues
response = client.responses.create(
    model="gpt-5",
    input=messages,
    tools=tools,
    parallel_tool_calls=False,  # Force sequential
    stream=True
)

# 3. Lower reasoning effort if timing issues
reasoning={"effort": "low", "summary": "brief"}
```

### Error: "Missing required parameter: 'input[N].content'"

**Cause:** Mixing Chat Completions message format with Responses API

**Solution:** Use proper Item format:
```python
# Wrong (Chat Completions format)
{"role": "assistant", "tool_calls": [...]}

# Correct (Responses API format)
{"type": "function_call", "call_id": "...", "name": "...", "arguments": "..."}
```

### Error: "Another process is currently operating on this conversation"

**Cause:** Making nested API calls during stream processing

**Solution:** Fully consume stream, collect all function calls, THEN process:
```python
# Collect all function calls first
function_calls = []
for event in response:
    if event.type == "response.function_call_arguments.done":
        function_calls.append({...})

# After stream complete, process functions
for fc in function_calls:
    result = execute_function(fc)
    # ...
```

---

## Best Practices

### 1. Stream Processing Pattern

```python
async def process_stream_with_tools(messages, tools, max_iterations=5):
    """Robust streaming with tool execution loop."""

    previous_response_id = None
    tool_outputs = None

    for iteration in range(max_iterations):
        # Build request
        request_params = {
            "model": "gpt-5",
            "tools": tools,
            "reasoning": {"effort": "high", "summary": "detailed"},
            "stream": True
        }

        if previous_response_id and tool_outputs:
            request_params["previous_response_id"] = previous_response_id
            request_params["input"] = tool_outputs
        else:
            request_params["input"] = messages

        response = client.responses.create(**request_params)

        response_id = None
        pending_calls = {}
        got_text = False

        for event in response:
            if event.type == "response.created":
                response_id = event.response.id

            elif event.type == "response.output_item.added":
                if event.item.type == "function_call":
                    pending_calls[event.item.call_id] = {
                        "name": event.item.name,
                        "arguments": ""
                    }

            elif event.type == "response.function_call_arguments.done":
                # Update with final arguments
                for call_id in pending_calls:
                    if not pending_calls[call_id].get("done"):
                        pending_calls[call_id]["arguments"] = event.arguments
                        pending_calls[call_id]["done"] = True
                        break

            elif event.type == "response.output_text.delta":
                got_text = True
                yield {"type": "text", "content": event.delta}

            elif event.type == "response.reasoning_text.delta":
                yield {"type": "reasoning", "content": event.delta}

        # If we got text, we're done
        if got_text:
            break

        # If we have pending calls, execute them
        if pending_calls:
            tool_outputs = []
            for call_id, info in pending_calls.items():
                result = await execute_tool(info["name"], json.loads(info["arguments"]))
                tool_outputs.append({
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": result
                })
            previous_response_id = response_id
            continue

        # No text and no tools = something went wrong
        break
```

### 2. Tracking call_id Correctly

```python
# During streaming, track call_id from output_item.added
item_to_call_id = {}  # Maps item.id -> item.call_id

for event in response:
    if event.type == "response.output_item.added":
        if event.item.type == "function_call":
            # Store the mapping
            item_to_call_id[event.item.id] = event.item.call_id

    elif event.type == "response.function_call_arguments.done":
        # event has item_id, use mapping to get call_id
        call_id = item_to_call_id.get(event.item_id)
```

### 3. Reasoning Model Considerations

For models with reasoning (o1, o3, gpt-5):

```python
response = client.responses.create(
    model="gpt-5",
    input=messages,
    tools=tools,
    reasoning={
        "effort": "high",      # "low", "medium", "high"
        "summary": "detailed"  # "brief", "detailed", "none"
    },
    stream=True
)
```

**Note:** Higher reasoning effort may cause timing issues with tool calls. If experiencing errors, try lowering to "medium" or "low".

---

## Sources

- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI Streaming Responses](https://platform.openai.com/docs/guides/streaming-responses)
- [Migrate to Responses API](https://platform.openai.com/docs/guides/migrate-to-responses)
- [Responses API Reference](https://platform.openai.com/docs/api-reference/responses)
- [OpenAI Developer Community - Streaming Events Guide](https://community.openai.com/t/responses-api-streaming-the-simple-guide-to-events/1363122)
- [OpenAI Developer Community - Tool Output Issues](https://community.openai.com/t/openai-responses-api-no-tool-output-found-for-function-call-when-using-previous-response-id-anyone-have-a-stable-workaround/1354672)
