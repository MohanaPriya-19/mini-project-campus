const PriorityRule = require('../models/PriorityRule')

/**
 * Determines complaint priority by matching description keywords
 * against configurable PriorityRule documents in the database.
 * Falls back to the category's defaultPriority if no rules match.
 */
async function determinePriority(categoryName, description, defaultPriority = 'Medium') {
  try {
    const rules = await PriorityRule.find({ categoryName })
    if (!rules.length) return defaultPriority

    const lowerDesc = description.toLowerCase()
    let bestPriority = defaultPriority
    let bestWeight = 0

    const priorityRank = { High: 3, Medium: 2, Low: 1 }

    for (const rule of rules) {
      const matched = rule.keywords.some((kw) => lowerDesc.includes(kw))
      if (matched && rule.weight > bestWeight) {
        bestWeight = rule.weight
        if (priorityRank[rule.priority] > priorityRank[bestPriority]) {
          bestPriority = rule.priority
        }
      }
    }

    return bestPriority
  } catch (err) {
    console.error('Priority determination error:', err.message)
    return defaultPriority
  }
}

module.exports = { determinePriority }
