#!/usr/bin/env python3
"""Convert the BFM eval markdown report to PDF using WeasyPrint."""

import sys
import os

md_path = "/Users/joncameron/Code/bfm-copilot/eval/bfm-eval-mar2026/BFM-Patient-Eval-Report-Mar2026.md"
pdf_path = "/Users/joncameron/Code/bfm-copilot/eval/bfm-eval-mar2026/BFM-Patient-Eval-Report-Mar2026.pdf"

# Read markdown
with open(md_path, "r") as f:
    md_content = f.read()

# Convert markdown to HTML
import markdown
html_body = markdown.markdown(
    md_content,
    extensions=["tables", "toc", "fenced_code", "nl2br"]
)

# Wrap in full HTML with CSS styling
html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page {{
    size: letter;
    margin: 0.85in 0.75in 0.85in 0.75in;
    @bottom-center {{
      content: "BFM Copilot — Confidential Patient Report — " counter(page) " / " counter(pages);
      font-size: 8pt;
      color: #888;
    }}
  }}
  body {{
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #1a1a1a;
  }}
  h1 {{
    font-size: 20pt;
    color: #1a2e4a;
    border-bottom: 3px solid #1a2e4a;
    padding-bottom: 6px;
    margin-top: 0;
  }}
  h2 {{
    font-size: 15pt;
    color: #1a2e4a;
    border-bottom: 2px solid #c0d0e8;
    padding-bottom: 4px;
    margin-top: 28px;
    page-break-after: avoid;
  }}
  h3 {{
    font-size: 12pt;
    color: #2a4a7a;
    margin-top: 18px;
    page-break-after: avoid;
  }}
  h4 {{
    font-size: 10.5pt;
    color: #3a3a3a;
    margin-top: 14px;
    page-break-after: avoid;
  }}
  table {{
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }}
  th {{
    background-color: #1a2e4a;
    color: white;
    padding: 6px 8px;
    text-align: left;
    font-weight: bold;
  }}
  td {{
    padding: 5px 8px;
    border: 1px solid #d0d8e8;
    vertical-align: top;
  }}
  tr:nth-child(even) td {{
    background-color: #f4f7fc;
  }}
  blockquote {{
    border-left: 4px solid #e8a000;
    background: #fffbf0;
    padding: 8px 14px;
    margin: 12px 0;
    color: #5a4000;
    font-size: 9.5pt;
  }}
  code {{
    background: #f0f4f8;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: "Courier New", monospace;
    font-size: 8.5pt;
  }}
  pre {{
    background: #f0f4f8;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 8.5pt;
  }}
  ul, ol {{
    margin: 6px 0;
    padding-left: 22px;
  }}
  li {{
    margin: 3px 0;
  }}
  hr {{
    border: none;
    border-top: 2px solid #1a2e4a;
    margin: 30px 0 20px 0;
  }}
  p {{
    margin: 6px 0;
  }}
  strong {{
    color: #1a1a1a;
  }}
  /* Patient section separators */
  h1[id^="patient"] {{
    page-break-before: always;
    padding-top: 10px;
  }}
  .cover {{
    text-align: center;
    padding: 60px 0 40px 0;
  }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

# Write HTML for debugging
html_path = pdf_path.replace(".pdf", ".html")
with open(html_path, "w") as f:
    f.write(html)

print(f"HTML written to: {html_path}")

# Generate PDF
from weasyprint import HTML, CSS
print("Generating PDF...")
HTML(string=html, base_url=os.path.dirname(md_path)).write_pdf(pdf_path)
print(f"PDF written to: {pdf_path}")
print(f"PDF size: {os.path.getsize(pdf_path):,} bytes")
