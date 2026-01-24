import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Test data matching expected case study outputs
const EXPECTED_FREQUENCIES = {
  thyroid: ['SNS Balance', 'Medula Support', 'Pit P Support'],
  neurological: ['Vagus Support', 'PNS Support', 'Cyto Lower', 'Leptin Resist', 'Kidney Support'],
  hormones: ['CP-P', 'Alpha Theta', 'Biotoxin'],
  diabetes: ['SNS Balance', 'Alpha Theta', 'Sacral Plexus', 'NS EMF', 'Kidney Vitality', 'Kidney Repair'],
}

const EXPECTED_SUPPLEMENTS = {
  thyroid: ['Serculate', 'Cell Synergy', 'Tri Salts', 'X39', 'Deuterium Drops'],
  neurological: ['Cell Synergy', 'Pectasol-C', 'Apex', 'Deuterium Drops'],
  hormones: ['Cell Synergy', 'X-39'],
  diabetes: ['Cell Synergy', 'X39', 'Deuterium'],
}

// Supabase client for direct database testing
let supabase: ReturnType<typeof createClient>
let approvedFrequencies: Array<{ name: string; aliases: string[]; category: string | null }>

beforeAll(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials in environment')
  }

  supabase = createClient(supabaseUrl, supabaseKey)

  // Fetch approved frequency list once
  const { data, error } = await supabase
    .from('approved_frequency_names')
    .select('name, aliases, category')
    .eq('is_active', true)

  if (error) throw error
  approvedFrequencies = data || []
})

// ============================================
// HELPER FUNCTIONS (matching frequency-validator.ts logic)
// ============================================

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

type MatchResult = {
  valid: boolean
  matchedName: string | null
  matchType: 'exact' | 'alias' | 'fuzzy' | 'none'
}

function matchFrequency(input: string): MatchResult {
  const normalizedInput = input.toLowerCase().trim()

  // 1. Exact match
  const exactMatch = approvedFrequencies.find(
    (f) => f.name.toLowerCase().trim() === normalizedInput
  )
  if (exactMatch) {
    return { valid: true, matchedName: exactMatch.name, matchType: 'exact' }
  }

  // 2. Alias match
  for (const freq of approvedFrequencies) {
    const aliasMatch = freq.aliases?.find(
      (alias) => alias.toLowerCase().trim() === normalizedInput
    )
    if (aliasMatch) {
      return { valid: true, matchedName: freq.name, matchType: 'alias' }
    }
  }

  // 3. Fuzzy match (Levenshtein distance <= 2)
  const FUZZY_THRESHOLD = 2
  let closestMatch: { name: string; distance: number } | null = null

  for (const freq of approvedFrequencies) {
    const distance = levenshteinDistance(normalizedInput, freq.name.toLowerCase())
    if (distance <= FUZZY_THRESHOLD && (!closestMatch || distance < closestMatch.distance)) {
      closestMatch = { name: freq.name, distance }
    }

    for (const alias of freq.aliases || []) {
      const aliasDistance = levenshteinDistance(normalizedInput, alias.toLowerCase())
      if (aliasDistance <= FUZZY_THRESHOLD && (!closestMatch || aliasDistance < closestMatch.distance)) {
        closestMatch = { name: freq.name, distance: aliasDistance }
      }
    }
  }

  if (closestMatch) {
    return { valid: true, matchedName: closestMatch.name, matchType: 'fuzzy' }
  }

  return { valid: false, matchedName: null, matchType: 'none' }
}

// ============================================
// DATABASE ALIAS VERIFICATION TESTS
// ============================================

describe('Database Alias Configuration', () => {
  it('should have "Pit P Support" alias for "Pituitary P Supp"', async () => {
    const { data } = await supabase
      .from('approved_frequency_names')
      .select('name, aliases')
      .eq('name', 'Pituitary P Supp')
      .single()

    expect(data).toBeTruthy()
    expect(data?.aliases).toContain('Pit P Support')
  })

  it('should have "NS EMF" alias for "EMF NS"', async () => {
    const { data } = await supabase
      .from('approved_frequency_names')
      .select('name, aliases')
      .eq('name', 'EMF NS')
      .single()

    expect(data).toBeTruthy()
    expect(data?.aliases).toContain('NS EMF')
  })

  it('should have "Kidney Support" frequency', async () => {
    const { data } = await supabase
      .from('approved_frequency_names')
      .select('name')
      .eq('name', 'Kidney Support')
      .single()

    expect(data).toBeTruthy()
    expect(data?.name).toBe('Kidney Support')
  })

  it('should have "Medulla Support" for fuzzy matching "Medula Support"', async () => {
    const { data } = await supabase
      .from('approved_frequency_names')
      .select('name')
      .eq('name', 'Medulla Support')
      .single()

    expect(data).toBeTruthy()
    expect(data?.name).toBe('Medulla Support')
  })
})

// ============================================
// FREQUENCY MATCHING TESTS
// ============================================

describe('Frequency Matching Logic', () => {
  describe('Exact Matching', () => {
    const exactMatchCases = [
      'SNS Balance',
      'PNS Support',
      'Cyto Lower',
      'Leptin Resist',
      'CP-P',
      'Alpha Theta',
      'Biotoxin',
      'Sacral Plexus',
      'Kidney Vitality',
      'Kidney Repair',
      'Kidney Support',
    ]

    it.each(exactMatchCases)('should exact match "%s"', (freq) => {
      const result = matchFrequency(freq)
      expect(result.valid).toBe(true)
      expect(result.matchType).toBe('exact')
      expect(result.matchedName).toBe(freq)
    })
  })

  describe('Alias Matching', () => {
    it('should match "Pit P Support" to "Pituitary P Supp"', () => {
      const result = matchFrequency('Pit P Support')
      expect(result.valid).toBe(true)
      expect(result.matchType).toBe('alias')
      expect(result.matchedName).toBe('Pituitary P Supp')
    })

    it('should match "NS EMF" to "EMF NS"', () => {
      const result = matchFrequency('NS EMF')
      expect(result.valid).toBe(true)
      expect(result.matchType).toBe('alias')
      expect(result.matchedName).toBe('EMF NS')
    })
  })

  describe('Fuzzy Matching', () => {
    it('should fuzzy match "Medula Support" to "Medulla Support" (1 char diff)', () => {
      const result = matchFrequency('Medula Support')
      expect(result.valid).toBe(true)
      expect(result.matchType).toBe('fuzzy')
      expect(result.matchedName).toBe('Medulla Support')
    })

    it('should fuzzy match case-insensitive variations', () => {
      const result = matchFrequency('sns balance')
      expect(result.valid).toBe(true)
      expect(result.matchedName).toBe('SNS Balance')
    })
  })

  describe('Hz Value Rejection', () => {
    const hzPatterns = [
      '40/116',
      '40 Hz',
      '40Hz',
      '40.5/116.2',
      '116/40',
      '40 hz',
    ]

    const HZ_PATTERN = /\d+\.?\d*\s*\/\s*\d+\.?\d*|\d+\.?\d*\s*[Hh][Zz]/

    it.each(hzPatterns)('should reject Hz value pattern "%s"', (pattern) => {
      expect(HZ_PATTERN.test(pattern)).toBe(true)
    })
  })
})

// ============================================
// CASE STUDY EXPECTED FREQUENCIES
// ============================================

describe('Case Study Expected Frequencies', () => {
  describe('Thyroid Case Study (thyroid-cs1)', () => {
    it.each(EXPECTED_FREQUENCIES.thyroid)('should match expected frequency "%s"', (freq) => {
      const result = matchFrequency(freq)
      expect(result.valid).toBe(true)
    })
  })

  describe('Neurological Case Study (neurological-cs5)', () => {
    it.each(EXPECTED_FREQUENCIES.neurological)('should match expected frequency "%s"', (freq) => {
      const result = matchFrequency(freq)
      expect(result.valid).toBe(true)
    })
  })

  describe('Hormones Case Study (hormones-cs2)', () => {
    it.each(EXPECTED_FREQUENCIES.hormones)('should match expected frequency "%s"', (freq) => {
      const result = matchFrequency(freq)
      expect(result.valid).toBe(true)
    })
  })

  describe('Diabetes Case Study (diabetes-cs4)', () => {
    it.each(EXPECTED_FREQUENCIES.diabetes)('should match expected frequency "%s"', (freq) => {
      const result = matchFrequency(freq)
      expect(result.valid).toBe(true)
    })
  })
})

// ============================================
// SUPPLEMENTATION IN RAG CONTENT
// ============================================

describe('Sunday RAG Content Availability', () => {
  it('should have Sunday session documents in the knowledge base', async () => {
    // seminar_day is on documents table, not document_chunks
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('seminar_day', 'sunday')

    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThan(0)
  })

  it('should have chunks from Sunday session documents', async () => {
    // Get Sunday document IDs first, then check for chunks
    const { data: sundayDocs } = await supabase
      .from('documents')
      .select('id')
      .eq('seminar_day', 'sunday')
      .limit(5)

    if (sundayDocs && sundayDocs.length > 0) {
      const docIds = sundayDocs.map(d => d.id)
      const { count, error } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .in('document_id', docIds)

      expect(error).toBeNull()
      expect(count).toBeGreaterThan(0)
    }
  })
})

// ============================================
// SUPPLEMENTATION PROMPT CONFIGURATION
// ============================================

describe('Analysis Generator Supplementation Config', () => {
  it('should include supplementation triggers in prompt', async () => {
    // Read the analysis-generator.ts file and verify supplementation triggers exist
    const fs = await import('fs/promises')
    const content = await fs.readFile('src/lib/rag/analysis-generator.ts', 'utf-8')

    expect(content).toContain('SUPPLEMENTATION TRIGGERS')
    expect(content).toContain('Cell Synergy')
    expect(content).toContain('X39')
    expect(content).toContain('Pectasol')
    expect(content).toContain('pH low on UA')
    expect(content).toContain('VCS failed')
  })

  it('should NOT gate supplementation on hasLabs', async () => {
    const fs = await import('fs/promises')
    const content = await fs.readFile('src/lib/rag/analysis-generator.ts', 'utf-8')

    // Verify the old pattern is removed - supplementation should always be included
    expect(content).toContain('supplementation: parsed.supplementation || []')
    // The prompt should say to include supplements for ALL diagnostics
    expect(content).toContain('Include supplementation recommendations based on ALL diagnostic findings')
  })
})
