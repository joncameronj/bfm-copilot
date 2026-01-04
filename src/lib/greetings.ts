type TimeOfDay = 'morning' | 'afternoon' | 'evening'

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  return 'evening'
}

interface Greeting {
  template: string
  timeOfDay?: TimeOfDay // If set, only show during this time
}

const greetings: Greeting[] = [
  // Time-based - Morning (5)
  { template: 'Good morning, {name}. What can I help you with today?', timeOfDay: 'morning' },
  { template: 'Rise and shine, {name}. What do you need help with?', timeOfDay: 'morning' },
  { template: 'Morning, {name}. What\'s the plan today?', timeOfDay: 'morning' },
  { template: 'Good morning, {name}. Let\'s make progress today.', timeOfDay: 'morning' },
  { template: 'Good morning, {name}. What\'s first on the agenda?', timeOfDay: 'morning' },

  // Time-based - Afternoon (5)
  { template: 'Good afternoon, {name}. How can I assist you?', timeOfDay: 'afternoon' },
  { template: 'Good afternoon, {name}. Ready to assist.', timeOfDay: 'afternoon' },
  { template: 'Afternoon, {name}. What brings you here?', timeOfDay: 'afternoon' },
  { template: 'Good afternoon, {name}. What would you like to work on?', timeOfDay: 'afternoon' },
  { template: 'Good afternoon, {name}. Let\'s dive in.', timeOfDay: 'afternoon' },

  // Time-based - Evening (5)
  { template: 'Good evening, {name}. What\'s on your mind?', timeOfDay: 'evening' },
  { template: 'Evening, {name}. What can I do for you?', timeOfDay: 'evening' },
  { template: 'Good evening, {name}. How can I be of service?', timeOfDay: 'evening' },
  { template: 'Evening, {name}. Ready when you are.', timeOfDay: 'evening' },
  { template: 'Good evening, {name}. How can I help?', timeOfDay: 'evening' },

  // Welcome/Return (15) - Any time
  { template: 'Welcome back, {name}. What can I help with?' },
  { template: 'Great to see you, {name}. What do you need?' },
  { template: 'Hello again, {name}. How can I help?' },
  { template: 'Welcome, {name}. What can I do for you?' },
  { template: 'Hey there, {name}. Ready to help.' },
  { template: 'Hi, {name}. What brings you in today?' },
  { template: 'Hello, {name}. What do you need help with?' },
  { template: 'Welcome back, {name}. What\'s on your mind?' },
  { template: 'Good to see you, {name}. How can I assist?' },
  { template: 'Hi there, {name}. What can I help with?' },
  { template: 'Welcome, {name}. Ready to assist.' },
  { template: 'Hello, {name}. How can I be of help?' },
  { template: 'Back again, {name}. What do you need?' },
  { template: 'Hi, {name}. Let\'s get to work.' },
  { template: 'Welcome back, {name}. How can I help today?' },

  // Action-oriented (10) - Any time
  { template: 'Ready when you are, {name}. What do you need?' },
  { template: 'Let\'s get started, {name}. What can I help with?' },
  { template: 'At the ready, {name}. What do you need?' },
  { template: 'Standing by, {name}. How can I assist?' },
  { template: 'Let\'s make it happen, {name}. What\'s the task?' },
  { template: 'Ready to help, {name}. What\'s up?' },
  { template: 'All set, {name}. What do you need?' },
  { template: 'Let\'s do this, {name}. How can I help?' },
  { template: 'Prepared and ready, {name}. What\'s on the agenda?' },
  { template: 'At your service, {name}. What can I do?' },

  // Supportive (10) - Any time
  { template: 'Here to help, {name}. What do you need?' },
  { template: 'How can I support you today, {name}?' },
  { template: 'What can I help you accomplish, {name}?' },
  { template: 'Here for you, {name}. What\'s needed?' },
  { template: 'How may I assist you, {name}?' },
  { template: 'What would be most helpful, {name}?' },
  { template: 'I\'m here, {name}. What do you need?' },
  { template: 'Ready to assist, {name}. What\'s on your mind?' },
  { template: 'How can I make your day easier, {name}?' },
  { template: 'What can I do for you today, {name}?' },
]

/**
 * Generate a deterministic index based on date and user name.
 * This ensures the same greeting is shown on server and client (fixes hydration).
 * The greeting changes daily for variety.
 */
function getDailyGreetingIndex(length: number, firstName: string | null): number {
  const today = new Date().toDateString()
  const seed = `${today}-${firstName || 'guest'}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash) % length
}

function formatGreeting(template: string, firstName: string | null): string {
  if (firstName) {
    return template.replace('{name}', firstName)
  }
  // Remove ", {name}" or ", {name}." patterns and clean up
  return template
    .replace(/, \{name\}\./g, '.')
    .replace(/, \{name\}/g, '')
    .replace(/ \{name\}\./g, '.')
    .replace(/ \{name\}/g, '')
    .replace(/\{name\}, /g, '')
    .replace(/\{name\}/g, '')
}

export function getGreeting(firstName: string | null = null): string {
  const timeOfDay = getTimeOfDay()

  // Filter greetings: include time-specific ones for current time, plus all generic ones
  const availableGreetings = greetings.filter(
    (g) => !g.timeOfDay || g.timeOfDay === timeOfDay
  )

  // Pick a deterministic greeting based on date (fixes hydration mismatch)
  const index = getDailyGreetingIndex(availableGreetings.length, firstName)
  const selected = availableGreetings[index]

  return formatGreeting(selected.template, firstName)
}
