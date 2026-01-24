// Demo mode hard-coded responses for case study files
// These return exact expected outputs for 4 specific case studies

import type { RecommendedFrequency, Supplementation } from '@/types/diagnostic-analysis'

export type CaseStudyKey = 'thyroid-cs1' | 'neurological-cs5' | 'hormones-cs2' | 'diabetes-cs4'

interface DemoProtocol {
  title: string
  description: string
  category: string
  frequencies: RecommendedFrequency[]
  priority: number
}

export interface DemoResponse {
  summary: string
  protocols: DemoProtocol[]
  supplementation: Supplementation[]
  reasoningChain: string[]
}

// ============================================
// THYROID CASE STUDY 1
// ============================================

const thyroidCs1Response: DemoResponse = {
  summary: `This patient presents with classic thyroid dysfunction patterns visible across multiple diagnostic markers. The HRV analysis shows sympathetic nervous system dominance, suggesting chronic stress response that often accompanies thyroid imbalances. Think of the sympathetic nervous system like a car's accelerator pedal stuck partially down - the body is constantly in a mild "fight or flight" state.

The D-Pulse findings reveal medullary stress patterns, which is significant because the medulla controls many autonomic functions that interact with thyroid regulation. The pituitary involvement (Pit P) is particularly noteworthy - as the "master gland," pituitary dysfunction often presents alongside thyroid issues since TSH production occurs here.

Based on the BFM Sunday session protocols, the priority is to first balance the autonomic nervous system (SNS Balance), then support the medullary function, followed by pituitary support. The supplementation protocol follows Dr. Rob's standard thyroid support stack with Serculate for circulation, Cell Synergy for cellular energy, Tri Salts for mineral balance, X39 patches for tissue regeneration, and Deuterium Drops for mitochondrial optimization.`,
  protocols: [
    {
      title: 'Autonomic Nervous System Rebalancing',
      description: 'Primary focus on reducing sympathetic dominance and restoring ANS balance',
      category: 'neurological',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'SNS Balance',
          rationale: 'HRV shows sympathetic dominance - this frequency helps restore autonomic balance',
          source_reference: 'BFM Sunday Session - Thyroid Protocols',
          diagnostic_trigger: 'Sympathetic dominance on HRV'
        }
      ],
      priority: 1
    },
    {
      title: 'Medullary Support Protocol',
      description: 'Support medullary function to improve autonomic regulation',
      category: 'neurological',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Medula Support',
          rationale: 'D-Pulse shows medullary stress markers requiring targeted support',
          source_reference: 'BFM Sunday Session - Thyroid Case Studies',
          diagnostic_trigger: 'Medullary stress on D-Pulse'
        }
      ],
      priority: 2
    },
    {
      title: 'Pituitary Support Protocol',
      description: 'Support pituitary function for improved TSH regulation',
      category: 'hormone',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Pit P Support',
          rationale: 'Pituitary involvement indicated - supports master gland function for thyroid regulation',
          source_reference: 'BFM Sunday Session - Thyroid Protocols',
          diagnostic_trigger: 'Pituitary markers on diagnostic panel'
        }
      ],
      priority: 3
    }
  ],
  supplementation: [
    {
      name: 'Serculate',
      dosage: 'As directed',
      timing: 'Morning',
      rationale: 'Supports circulation and thyroid tissue perfusion'
    },
    {
      name: 'Cell Synergy',
      dosage: 'As directed',
      timing: 'With meals',
      rationale: 'Provides cellular energy support critical for thyroid function'
    },
    {
      name: 'Tri Salts',
      dosage: 'As directed',
      timing: 'With meals',
      rationale: 'Mineral balance support for optimal thyroid hormone production'
    },
    {
      name: 'X39',
      dosage: '1 patch',
      timing: 'Daily application',
      rationale: 'Stem cell activation and tissue regeneration support'
    },
    {
      name: 'Deuterium Drops',
      dosage: 'As directed',
      timing: 'Morning',
      rationale: 'Mitochondrial optimization for cellular energy production'
    }
  ],
  reasoningChain: [
    'Step 1: HRV analysis reveals sympathetic nervous system dominance indicating chronic stress state',
    'Step 2: D-Pulse shows medullary and pituitary involvement - classic thyroid dysfunction pattern',
    'Step 3: Selected SNS Balance as primary frequency to restore autonomic balance',
    'Step 4: Added Medula Support for medullary stress patterns',
    'Step 5: Added Pit P Support for pituitary regulation of TSH',
    'Step 6: Supplementation follows BFM Sunday thyroid protocol stack'
  ]
}

// ============================================
// NEUROLOGICAL CASE STUDY 5
// ============================================

const neurologicalCs5Response: DemoResponse = {
  summary: `This patient demonstrates a complex neurological picture with significant vagal and parasympathetic involvement. The diagnostic data reveals compromised vagus nerve function, which acts as the body's "information superhighway" between the brain and organs. When vagal function is impaired, we see cascading effects throughout multiple body systems.

The cytokine elevation pattern suggests underlying inflammation affecting the nervous system - imagine the immune system's warning signals becoming too loud and persistent, creating noise that disrupts normal neural communication. The leptin resistance finding is particularly significant as it indicates metabolic-neural crosstalk dysfunction.

The kidney involvement shown on diagnostics suggests the need for renal support, as kidney function intimately connects with autonomic nervous system regulation. The protocol sequence prioritizes vagal support first, then PNS restoration, followed by addressing the inflammatory cascade, leptin resistance, and finally kidney support.`,
  protocols: [
    {
      title: 'Vagal Restoration Protocol',
      description: 'Primary focus on restoring optimal vagus nerve function',
      category: 'neurological',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Vagus Support',
          rationale: 'Compromised vagal function identified - critical for brain-body communication',
          source_reference: 'BFM Sunday Session - Neurological Protocols',
          diagnostic_trigger: 'Vagal dysfunction on HRV and D-Pulse'
        }
      ],
      priority: 1
    },
    {
      title: 'Parasympathetic Restoration',
      description: 'Support parasympathetic nervous system for rest and repair',
      category: 'neurological',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'PNS Support',
          rationale: 'PNS deficiency identified - need to restore rest-and-digest function',
          source_reference: 'BFM Sunday Session - Neurological Case Studies',
          diagnostic_trigger: 'Parasympathetic deficiency on HRV'
        }
      ],
      priority: 2
    },
    {
      title: 'Cytokine Modulation Protocol',
      description: 'Address elevated inflammatory cytokines affecting neural function',
      category: 'immune',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Cyto Lower',
          rationale: 'Elevated cytokines creating neuroinflammation - need to modulate immune response',
          source_reference: 'BFM Sunday Session - Inflammation and Neurological Function',
          diagnostic_trigger: 'Elevated inflammatory markers'
        }
      ],
      priority: 3
    },
    {
      title: 'Metabolic-Neural Protocol',
      description: 'Address leptin resistance affecting neural metabolism',
      category: 'metabolic',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Leptin Resist',
          rationale: 'Leptin resistance disrupting metabolic-neural communication',
          source_reference: 'BFM Sunday Session - Metabolic Neurological Connections',
          diagnostic_trigger: 'Leptin resistance markers'
        }
      ],
      priority: 4
    },
    {
      title: 'Renal Support Protocol',
      description: 'Support kidney function for autonomic regulation',
      category: 'general',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Kidney Support',
          rationale: 'Kidney involvement affecting autonomic regulation and fluid balance',
          source_reference: 'BFM Sunday Session - Kidney and Nervous System Connection',
          diagnostic_trigger: 'Kidney markers on D-Pulse'
        }
      ],
      priority: 5
    }
  ],
  supplementation: [
    {
      name: 'Cell Synergy',
      dosage: 'As directed',
      timing: 'With meals',
      rationale: 'Foundational cellular support for neural tissue repair'
    },
    {
      name: 'Pectasol-C',
      dosage: 'As directed',
      timing: 'Between meals',
      rationale: 'Modified citrus pectin for cytokine modulation and detoxification'
    },
    {
      name: 'Apex',
      dosage: 'As directed',
      timing: 'Morning',
      rationale: 'Adaptogenic support for neurological stress resilience'
    },
    {
      name: 'Deuterium Drops',
      dosage: 'As directed',
      timing: 'Morning',
      rationale: 'Mitochondrial support for neural energy production'
    }
  ],
  reasoningChain: [
    'Step 1: HRV and D-Pulse reveal significant vagal and PNS dysfunction',
    'Step 2: Inflammatory markers indicate elevated cytokines affecting neural function',
    'Step 3: Leptin resistance pattern suggests metabolic-neural crosstalk dysfunction',
    'Step 4: Kidney markers indicate need for renal support in autonomic regulation',
    'Step 5: Protocol sequence: Vagus → PNS → Cytokines → Leptin → Kidney',
    'Step 6: Supplementation targets inflammation (Pectasol-C) and cellular support (Cell Synergy)'
  ]
}

// ============================================
// HORMONES CASE STUDY 2
// ============================================

const hormonesCs2Response: DemoResponse = {
  summary: `This patient presents with a hormone dysregulation pattern that involves both the hypothalamic-pituitary axis and potential biotoxin burden. The CP-P pattern on diagnostics indicates central processing involvement - think of it as the brain's hormone control center having difficulty maintaining proper signal timing and intensity.

The brainwave analysis reveals alpha-theta imbalances, which is significant because these frequencies govern the transition between alert awareness and relaxed states. When this transition is disrupted, it affects hormone release cycles that depend on proper brain state regulation.

The biotoxin marker finding is particularly important - environmental toxins can mimic hormones or block receptor sites, creating confusion in the endocrine communication system. The protocol targets the central processing first, then addresses the brainwave patterns, and finally the biotoxin component.`,
  protocols: [
    {
      title: 'Central Processing Protocol',
      description: 'Address CP-P dysfunction affecting hormone regulation',
      category: 'hormone',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'CP-P',
          rationale: 'Central processing involvement affecting hypothalamic-pituitary axis function',
          source_reference: 'BFM Sunday Session - Hormone Protocols',
          diagnostic_trigger: 'CP-P pattern on diagnostic panel'
        }
      ],
      priority: 1
    },
    {
      title: 'Brainwave Normalization Protocol',
      description: 'Address alpha-theta imbalances affecting hormone cycles',
      category: 'neurological',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Alpha Theta',
          rationale: 'Alpha-theta imbalance disrupting hormone release timing',
          source_reference: 'BFM Sunday Session - Brainwaves and Hormones',
          diagnostic_trigger: 'Alpha-theta imbalance on brainwave analysis'
        }
      ],
      priority: 2
    },
    {
      title: 'Biotoxin Clearance Protocol',
      description: 'Address biotoxin burden affecting endocrine function',
      category: 'detox',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Biotoxin',
          rationale: 'Biotoxin markers indicate environmental toxin burden affecting hormone receptors',
          source_reference: 'BFM Sunday Session - Toxins and Hormones',
          diagnostic_trigger: 'Biotoxin markers on VCS and D-Pulse'
        }
      ],
      priority: 3
    }
  ],
  supplementation: [
    {
      name: 'Cell Synergy',
      dosage: 'As directed',
      timing: 'With meals',
      rationale: 'Cellular support for hormone-producing tissues'
    },
    {
      name: 'X-39',
      dosage: '1 patch',
      timing: 'Daily application',
      rationale: 'Supports tissue regeneration and hormone receptor sensitivity'
    }
  ],
  reasoningChain: [
    'Step 1: Diagnostic analysis reveals CP-P pattern indicating central processing dysfunction',
    'Step 2: Brainwave analysis shows alpha-theta imbalance affecting hormone cycles',
    'Step 3: VCS and D-Pulse indicate biotoxin burden affecting endocrine system',
    'Step 4: Protocol sequence: CP-P → Alpha Theta → Biotoxin clearance',
    'Step 5: Supplementation supports cellular function and receptor sensitivity'
  ]
}

// ============================================
// DIABETES/MALE CASE STUDY 4
// ============================================

const diabetesCs4Response: DemoResponse = {
  summary: `This male patient presents with a metabolic dysregulation pattern characteristic of insulin resistance and related complications. The HRV findings show sympathetic nervous system imbalance - the body's stress response is chronically elevated, which directly impacts blood sugar regulation. When the sympathetic system dominates, it's like having the gas pedal stuck, driving glucose levels up even without food intake.

The brainwave patterns show alpha-theta disruption, which affects the brain's regulation of metabolic hormones including insulin. The sacral plexus involvement is significant for male patients as this nerve network governs pelvic organ function including aspects of metabolic hormone signaling in that region.

Additional lab-triggered findings indicate the need for EMF protection protocols (NS EMF), kidney vitality support, and kidney repair frequencies. These lab markers point to the kidney-metabolic connection that is often compromised in metabolic dysfunction. The kidney plays a crucial role in glucose reabsorption and blood pressure regulation, both critical in metabolic health.`,
  protocols: [
    {
      title: 'Autonomic Rebalancing Protocol',
      description: 'Primary focus on reducing sympathetic dominance affecting glucose regulation',
      category: 'neurological',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'SNS Balance',
          rationale: 'Sympathetic dominance directly impacts insulin sensitivity and blood sugar regulation',
          source_reference: 'BFM Sunday Session - Diabetes Protocols',
          diagnostic_trigger: 'Sympathetic dominance on HRV'
        }
      ],
      priority: 1
    },
    {
      title: 'Brainwave Metabolic Protocol',
      description: 'Address brainwave patterns affecting metabolic hormone regulation',
      category: 'neurological',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Alpha Theta',
          rationale: 'Alpha-theta imbalance affecting brain regulation of metabolic hormones',
          source_reference: 'BFM Sunday Session - Brainwaves and Metabolism',
          diagnostic_trigger: 'Alpha-theta disruption on brainwave analysis'
        }
      ],
      priority: 2
    },
    {
      title: 'Sacral Plexus Support Protocol',
      description: 'Support sacral plexus function for male metabolic health',
      category: 'neurological',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Sacral Plexus +',
          rationale: 'Sacral plexus involvement affecting pelvic region metabolic signaling',
          source_reference: 'BFM Sunday Session - Male Metabolic Health',
          diagnostic_trigger: 'Sacral plexus markers on diagnostic panel'
        }
      ],
      priority: 3
    },
    {
      title: 'EMF Protection Protocol',
      description: 'Address EMF sensitivity affecting cellular metabolism',
      category: 'general',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'NS EMF',
          rationale: 'Lab markers indicate EMF sensitivity affecting metabolic function',
          source_reference: 'BFM Sunday Session - Environmental Factors in Diabetes',
          diagnostic_trigger: 'EMF sensitivity markers on labs'
        }
      ],
      priority: 4
    },
    {
      title: 'Kidney Vitality Protocol',
      description: 'Support kidney function for glucose and blood pressure regulation',
      category: 'general',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Kidney Vitality',
          rationale: 'Kidney function critical for glucose reabsorption and metabolic balance',
          source_reference: 'BFM Sunday Session - Kidney-Metabolic Connection',
          diagnostic_trigger: 'Kidney markers on labs'
        }
      ],
      priority: 5
    },
    {
      title: 'Kidney Repair Protocol',
      description: 'Support kidney tissue repair for optimal metabolic function',
      category: 'general',
      frequencies: [
        {
          id: crypto.randomUUID(),
          name: 'Kidney Repair',
          rationale: 'Lab markers indicate kidney tissue requiring repair support',
          source_reference: 'BFM Sunday Session - Kidney Repair in Metabolic Cases',
          diagnostic_trigger: 'Kidney repair markers on labs'
        }
      ],
      priority: 6
    }
  ],
  supplementation: [
    {
      name: 'Cell Synergy',
      dosage: 'As directed',
      timing: 'With meals',
      rationale: 'Foundational cellular support for metabolic function'
    },
    {
      name: 'X39',
      dosage: '1 patch',
      timing: 'Daily application',
      rationale: 'Supports tissue regeneration and insulin receptor sensitivity'
    },
    {
      name: 'Deuterium',
      dosage: 'As directed',
      timing: 'Morning',
      rationale: 'Mitochondrial optimization for cellular energy and glucose metabolism'
    }
  ],
  reasoningChain: [
    'Step 1: HRV reveals sympathetic dominance affecting glucose regulation',
    'Step 2: Brainwave analysis shows alpha-theta disruption affecting metabolic hormone regulation',
    'Step 3: Sacral plexus involvement identified for male metabolic health',
    'Step 4: Lab markers indicate EMF sensitivity, kidney vitality needs, and kidney repair requirements',
    'Step 5: Protocol sequence: SNS Balance → Alpha Theta → Sacral Plexus → NS EMF → Kidney Vitality → Kidney Repair',
    'Step 6: Supplementation supports cellular energy and tissue regeneration'
  ]
}

// ============================================
// EXPORT MAP
// ============================================

export const DEMO_RESPONSES: Record<CaseStudyKey, DemoResponse> = {
  'thyroid-cs1': thyroidCs1Response,
  'neurological-cs5': neurologicalCs5Response,
  'hormones-cs2': hormonesCs2Response,
  'diabetes-cs4': diabetesCs4Response,
}
