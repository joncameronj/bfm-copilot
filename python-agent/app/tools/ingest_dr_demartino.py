"""
Ingest Dr. Rob DeMartino's professional information into the knowledge base.
This script creates embeddings and stores them in the database for RAG retrieval.

Usage:
  python -m app.tools.ingest_dr_demartino
"""

import asyncio
import os
import sys
from uuid import UUID
from app.embeddings.embedder import get_embedding
from app.services.supabase import get_supabase_client

# Dr. DeMartino's information chunks
DR_DEMARTINO_CHUNKS = [
    {
        "title": "Dr. Rob DeMartino - Personal Journey and Inspiration",
        "content": """DR. ROB DEMARTINO - PERSONAL STORY AND LIFE PURPOSE

Dr. Robert DeMartino's commitment to natural healing comes from profound personal experience.

EARLY TRAGEDY
Dr. DeMartino's older sister was diagnosed with Ewing's Sarcoma, an aggressive form of bone cancer. After being seen by numerous doctors with diagnoses ranging from "nothing wrong" to juvenile rheumatoid arthritis, the true diagnosis came too late. His sister fought the disease for almost ten years before passing away just five weeks short of her 17th birthday. This devastating loss inspired young Dr. DeMartino to pursue medicine and help others suffering from chronic illness.

PERSONAL HEALTH CRISIS
Three months after his sister's death, Dr. DeMartino developed severe, debilitating migraines. For four years, multiple times per week, he would experience visual auras (seeing spots as if a camera had flashed), followed by a 45-minute window before the migraine reached full force. Once it did, he would be incapacitated in a dark, quiet room, unable to move, ultimately vomiting from the pain and then sleeping for 10 hours to recover. He missed school, friends, activities - missing life itself.

THE TURNING POINT
After visiting countless doctors with zero results, Dr. DeMartino's life changed when he visited a chiropractor for a sports-related lower back injury from playing basketball. During the full examination, the chiropractor discovered that Dr. DeMartino's neck was severely twisted, putting pressure on his spinal cord and causing the migraines. Though initially skeptical, within 2 weeks of chiropractic care, his headaches were gone - permanently. This experience sparked an obsession with natural healing.

CHIROPRACTIC SCHOOL AND FAMILY HEALTH CRISIS
At age 14, the chiropractor took Dr. DeMartino to his first seminar. He knew immediately that this was his life's calling. He pursued chiropractic education, but about 2 months into chiropractic school, his parents sat him down for a serious talk: his mother had been diagnosed with leukemia with an 8-year life expectancy based on her numbers.

Determined to make a different outcome than his family had experienced with his sister, Dr. DeMartino became intensely focused on learning as many healing modalities and technologies as possible to support his mother's recovery.

MOTHER'S RECOVERY AND EXPANSION OF HEALING
After graduating and establishing his practice, Dr. DeMartino became deeply involved in his mother's healthcare. He and his team employed many different healing approaches and advanced technologies. Slowly but surely, his mother's health improved. Remarkably, 19 years after her diagnosis, she is doing great and thriving.

HIS CALLING
Through these profound experiences - losing his sister, healing his own migraines, helping his mother recover from leukemia - Dr. DeMartino found his life's purpose:

To ensure that people suffering with chronic disease, even those told there are no options, know that there ARE things they can do to improve and reclaim their health.

This is the heart and soul behind the BFM Health System."""
    },
    {
        "title": "Dr. Rob DeMartino - Credentials and Dedication",
        "content": """DR. ROB DEMARTINO - PROFESSIONAL CREDENTIALS AND ACHIEVEMENTS

Graduated from Palmer College of Chiropractic in 2005 as a Doctor of Chiropractic. Dr. DeMartino has dedicated his career to the practice of healing people by using new technologies and finding the cause of problems, rather than medicating the symptoms.

CERTIFICATIONS AND RECOGNITIONS
- Chiropractoric Physicians Board Of Nevada (2005)
- Quantum Neurology Certified Practitioner (2011)
- Quantum Neurology Doctor of the Year (2016)
- Nationwide trainer for Functional Medicine Procedures
- Health Advisor for Whole Foods Henderson and Sun City McDonald Ranch
- Volunteer for The Foundation for Wellness Professionals and Well Rounded Momma
- Master Trainer for the Neurological Relief Centers (2010)
- Scientific Advisory Board member for Pulsed Harmonix

UNIQUE EXPERTISE
Dr. DeMartino is the only doctor in Nevada who implements comprehensive training in quantum neurology - a collection of techniques to evaluate and restore every major nerve in the body, thus allowing the body to better heal itself.

He has become known for his ability to help people living with pain and the effects of drugs and surgeries that haven't, and will never, solve their problems."""
    },
    {
        "title": "BFM Philosophy - Four Core Principles",
        "content": """DR. DEMARTINO'S BFM PHILOSOPHY - FOUR CORE PRINCIPLES

01. RESULTS ORIENTED
We want to position you to get the best possible results for your patients first and foremost, always and forever. The big goal is to change healthcare by changing the expectation of results that patients get with some more complicated style problems.

We bring the best and newest science - not the same stuff reproduced a different way with a new fancy bow on it. But real research-backed science that is underutilized in the application of advanced healthcare.

02. FULL-STACK KNOWLEDGE
We will give you the high level science behind the most common health concerns, but then also give you the communication strategies to explain why your patients are struggling with health issues and how you are uniquely suited to help them as an expert.

Not only does it make all the difference in the length of the conversations that you have with a patient, but it leaves your patient with a greater understanding of their problem and the path that they need to go on in order to get resolution.

03. RESEARCH-FOCUSED
You will probably be surprised how much research is actually out there backing our concepts on the foundation of disease - you just typically aren't told about it because it doesn't fit in the traditional treatment model of functional medicine.

If you can take this research and create actionable things to solve these issues, the game of getting people better gets a lot more straightforward.

04. CUTTING-EDGE TECH
Frankly, I hate the term cutting edge. Because it has become overused and in front of things that I would not consider cutting edge. The painful truth is that most functional medicine could have been practiced the exact same way if it was the early 2000s vs today.

While technology plays a role in a lot of the issues we experience today, it is also logical that if so many other problems are solved with the use of technology, why would the proper use of it in healthcare be any different?

Putting the right tech in your office allows you a unique solution that provides above and beyond solutions."""
    },
    {
        "title": "Energetic Debt - The Core Concept Behind BFM",
        "content": """ENERGETIC DEBT - THE CENTRAL CONCEPT OF BFM

"Energetic Debt" is Dr. DeMartino's foundational concept that explains why chronic diseases develop and persist. It's the cornerstone principle that separates BFM from conventional functional medicine.

WHAT IS ENERGETIC DEBT?
Energetic Debt refers to the accumulated metabolic, neurological, and physiological "debt" the body accumulates when it's forced to operate in states of chronic stress, poor nutrition, toxin exposure, or dysregulation. The body accumulates this debt when its energy production systems can't keep up with the demands placed on it.

THE PROBLEM WITH SYMPTOM-FOCUSED CARE
Most healthcare - conventional and even functional medicine - focuses on treating symptoms. Dr. DeMartino says: "We need to stop playing whack-a-mole with symptoms and actually trace the wiring."

The real problem isn't the symptom - it's the accumulated energetic debt that created the condition in the first place. You can't resolve chronic disease by addressing symptoms. You must identify and resolve the energetic debt that's driving the disease process.

HOW ENERGETIC DEBT MANIFESTS
The body can only compensate for energetic debt for so long. As debt accumulates, the body's regulatory systems begin to fail. This manifests as:
- Metabolic dysfunction (insulin resistance, weight gain despite diet/exercise)
- Autoimmune activation (thyroid attacks, systemic inflammation)
- Neurological dysregulation (brain fog, anxiety, mood changes)
- Hormonal imbalance (cortisol dysfunction, sex hormone dysregulation)
- Chronic pain and inflammation
- Biotoxic responses (mold sensitivity, Lyme disease complications)

THE BFM APPROACH TO ENERGETIC DEBT
Rather than asking "What symptom do we treat?" BFM asks "What caused the energetic debt accumulation?" and "How do we resolve that debt?"

By identifying and removing the sources of energetic debt, the body can begin to heal itself. This is why Dr. DeMartino's approach focuses on root cause identification rather than symptom management."""
    },
    {
        "title": "BFM Clinical Methodology and Approach",
        "content": """BFM METHODOLOGY - THE THREE CORE ELEMENTS

Dr. DeMartino's BFM methodology is built on three core elements designed to identify and resolve energetic debt:

1. PRECISE TESTING - Accurate diagnostic data collection to identify root causes
   - Comprehensive metabolic assessment
   - Neurological functional testing
   - Toxin and biotoxin evaluation
   - Immune and autoimmune markers
   - Stress physiology (HPA axis function)
   - Not just looking at "normal" ranges, but functional optimization

2. ADVANCED HEALTH TECHNOLOGY - Bioelectronic and frequency-based protocols to support body regulation
   - Frequency-based protocols to optimize nervous system function
   - Bioelectronic technologies for cellular communication restoration
   - Quantum neurology techniques for nerve function restoration
   - Technologies that help the body re-establish proper regulatory signals
   - Support for the body's natural ability to self-heal

3. PRACTICAL LIFESTYLE ADJUSTMENTS - Simplified, evidence-based modifications for sustained wellness
   - Sleep optimization and circadian rhythm restoration
   - Nutritional approaches based on individual metabolic needs
   - Stress management and nervous system regulation
   - Movement and physical restoration
   - Environmental toxin elimination

THE CLINICAL PHILOSOPHY
Rather than asking "What do we give this patient?" BFM asks "What is preventing this patient from healing?" The answer is always rooted in accumulated energetic debt from one or more sources:
- Chronic stress and HPA axis dysregulation
- Poor nutrition and metabolic dysfunction
- Toxin and biotoxin exposure
- Neurological dysregulation
- Immunological confusion (autoimmunity)
- Unresolved trauma or emotional patterns

By addressing these root causes systematically, the body can resolve the energetic debt and heal itself naturally."""
    },
    {
        "title": "Superior Health Solutions - Clinical Practice Business Model",
        "content": """SUPERIOR HEALTH SOLUTIONS (SHS) - CLINICAL PRACTICE

Location: Henderson, Nevada
Website: https://shslasvegas.com

BUSINESS MODEL AND SERVICES
Superior Health Solutions is Dr. DeMartino's clinical practice where he directly serves patients with complex, chronic health challenges. SHS operates on a functional medicine model focused on identifying and resolving energetic debt.

CORE SERVICES
- Comprehensive initial evaluation identifying root causes of chronic disease
- Advanced testing and assessment (metabolic, neurological, toxicological)
- Frequency-based protocol development and implementation
- Bioelectronic technology application and monitoring
- Long-term health restoration coaching and support
- Integration of multiple healing modalities tailored to individual needs

PATIENT POPULATIONS SERVED
- Patients with undiagnosed or treatment-resistant chronic conditions
- Autoimmune disease patients (especially thyroid and systemic conditions)
- Metabolic dysfunction (diabetes, insulin resistance, metabolic syndrome)
- Neurological conditions and chronic pain
- Biotoxin illness (mold exposure, Lyme disease)
- Hormone/adrenal dysregulation
- Patients who have been told "there are no options"

PHILOSOPHY
SHS operates on the principle that the body has an innate ability to heal when given the proper support. Rather than managing symptoms, SHS focuses on removing obstacles to healing and optimizing the body's regulatory systems.

The practice serves as both a healing center for patients and a living laboratory for BFM methodology development and refinement."""
    },
    {
        "title": "Beyond Functional Medicine - Business Model and Services",
        "content": """BEYOND FUNCTIONAL MEDICINE (BFM) - BUSINESS MODEL

Website: https://beyondfunctionalmedicine.com

BUSINESS PURPOSE
Beyond Functional Medicine is Dr. DeMartino's educational and coaching business designed to train other practitioners in the BFM methodology. Rather than treating patients directly, BFM serves as a knowledge transfer and system implementation platform for natural medicine practitioners who want to implement the BFM approach in their own practices.

CORE OFFERING
BFM provides practitioners with:
- Complete BFM methodology training
- Clinical seminars with detailed protocol analysis
- System implementation coaching
- Business model guidance
- Practitioner community and support
- Access to BFM clinical reasoning frameworks
- Integration protocols for practitioners' existing systems

SPECIALIZATION AREAS
BFM offers deep expertise in four clinical specializations:

1. CARDIOMETABOLIC HEALTH
   - Metabolic syndrome and insulin resistance (the "your labs look fine but you feel like a dumpster fire" category)
   - Cardiovascular disease prevention and reversal
   - Advanced lipid metabolism
   - Inflammation and metabolic dysfunction integration
   - Weight management and metabolic optimization

2. NEUROLOGICAL DISORDERS
   - Neurodegenerative disease prevention
   - Chronic fatigue syndrome and post-viral syndromes
   - Neuroinflammation and brain-based conditions
   - Cognitive dysfunction and brain fog
   - Pain neuroscience and neuropathic pain

3. BIOTOXIC ILLNESS
   - Mold exposure and mycotoxin protocols
   - Lyme disease and tick-borne illness complexity
   - Biotoxin-induced immune dysregulation
   - Terrain theory and host recovery
   - Circadian rhythm restoration for biotoxin recovery

4. AUTOIMMUNE AND THYROID DISEASE
   - The BFM 3-Part Treatment Codex for autoimmunity
   - Hashimoto's disease and thyroid-specific autoimmunity
   - Systemic autoimmune conditions
   - Immune tolerance restoration
   - Functional immune system optimization

TRAINING PHILOSOPHY
BFM training focuses on teaching practitioners to think like Dr. DeMartino thinks - to stop treating symptoms and start identifying energetic debt sources. Practitioners learn to ask "What is preventing this patient from healing?" rather than "What supplement should I prescribe?"

EXPECTED OUTCOMES
Practitioners trained in BFM methodology report:
- More consistent patient outcomes
- Higher patient satisfaction and referral rates
- Greater clinical confidence when facing complex cases
- Ability to help patients with treatment-resistant conditions
- Business growth through differentiation and specialization"""
    },
    {
        "title": "BFM Frequency Protocol Categories",
        "content": """BFM FREQUENCY PROTOCOL CATEGORIES

The BFM System organizes frequency-based protocols into four main categories:

1. THYROID PROTOCOLS (74 protocols)
   - For thyroid dysfunction, Hashimoto's disease, and thyroid autoimmunity
   - Support for thyroid hormone metabolism and immune regulation
   - Protocols for iodine metabolism, peroxidase function, and thyroglobulin issues

2. DIABETES PROTOCOLS (60 protocols)
   - For type 1 and type 2 diabetes management
   - Insulin resistance and metabolic syndrome protocols
   - Blood sugar regulation and pancreatic support
   - Cardiometabolic complications prevention

3. NEUROLOGICAL PROTOCOLS (49 protocols)
   - For neurodegenerative conditions and chronic pain
   - Brain inflammation and neuroinflammation support
   - Neuropathy and nerve regeneration protocols
   - Cognitive function and neurotransmitter support

4. HORMONE PROTOCOLS (76 protocols)
   - For hormonal dysregulation and endocrine support
   - HPA axis (hypothalamic-pituitary-adrenal) protocols
   - Sex hormone balance and reproductive health
   - Stress physiology and cortisol regulation

All protocols are based on Dr. DeMartino's clinical methodology and are designed for practitioner use in patient care."""
    },
    {
        "title": "What Makes BFM Different From Other Approaches",
        "content": """WHAT MAKES BFM FUNDAMENTALLY DIFFERENT

"Stop playing whack-a-mole with symptoms and actually trace the wiring." - Dr. Rob DeMartino

BFM represents a paradigm shift from how most healthcare approaches chronic disease. Here's what distinguishes it:

CONVENTIONAL MEDICINE
- Approach: Symptom suppression with pharmaceuticals
- Question: "What drug treats this symptom?"
- Result: Disease progression, iatrogenic effects, dependency

FUNCTIONAL MEDICINE (Traditional)
- Approach: Nutritional supplementation and lifestyle modification
- Question: "What supplement supports this marker?"
- Result: Often better than conventional, but still symptom-focused

BFM APPROACH
- Approach: Root cause identification and energetic debt resolution
- Question: "What is preventing this patient from healing?"
- Framework: The energetic debt model - understanding WHY the body broke down
- Result: Actual resolution of disease, not just symptom management

KEY DIFFERENCES

1. SYSTEMS THINKING
BFM doesn't treat thyroid disease OR diabetes OR neurological issues. BFM treats the PERSON and recognizes that these conditions often stem from the same energetic debt sources. A diabetic with thyroid autoimmunity and neuropathy isn't three separate patients - it's one person with interconnected dysfunction.

2. BIOTECHNOLOGY INTEGRATION
While most functional medicine relies on supplements alone, BFM integrates:
- Frequency-based protocols (quantum biology)
- Bioelectronic technologies (cellular signaling restoration)
- Quantum neurology (nerve function assessment and restoration)
- Advanced diagnostics (not just lab values, but functional assessment)

3. MEASUREMENT AND ACCOUNTABILITY
BFM emphasizes measurable, consistent results. Not "how do you feel?" but objective improvement in function, labs, and symptom resolution. Dr. DeMartino's goal is to make outcomes predictable and repeatable across different practitioners.

4. PRACTITIONER EMPOWERMENT
Rather than keeping clinical knowledge proprietary, BFM trains other practitioners to implement the system. This multiplies the impact - every trained BFM practitioner becomes another healing center for patients with complex, chronic disease.

5. THE ENERGETIC DEBT FRAMEWORK
This is the secret sauce. Once you understand energetic debt - accumulated metabolic, neurological, and physiological stress - everything else makes sense. You stop being surprised when your nutrition recommendations don't work for that patient. You understand why they're not healing. And you know exactly what needs to be addressed.

DR. DEMARTINO'S TEACHING STYLE
Direct. Systems-based. Practical. With enough wit to keep complex biochemistry from feeling like a tax seminar. He teaches you not just WHAT to do, but WHY it works, and HOW to think about cases the BFM way.

THE ULTIMATE GOAL
Dr. DeMartino's vision: To ensure that people suffering with chronic disease - even those told "there are no options" - know that there ARE things they can do to improve and reclaim their health.

BFM isn't just a clinical system. It's a movement to change healthcare by changing outcomes."""
    }
]

async def ingest_dr_demartino_knowledge():
    """
    Ingest Dr. Rob DeMartino's professional information into the knowledge base.
    Creates embeddings for each chunk and stores them in the database.
    """
    client = get_supabase_client()

    try:
        # Find an admin user to associate this document with
        # (documents must have a user_id, but is_global=TRUE makes them available to all)
        admin_result = client.table('profiles').select('id').eq(
            'role', 'admin'
        ).limit(1).execute()

        if not admin_result.data:
            print("❌ No admin user found. Cannot ingest document without a user_id.")
            print("   Please ensure at least one admin user exists.")
            sys.exit(1)

        admin_user_id = admin_result.data[0]['id']

        # Check if Dr. DeMartino document already exists
        result = client.table('documents').select('id').eq(
            'filename', 'Dr_Rob_DeMartino_Professional_Profile.txt'
        ).execute()

        if result.data:
            doc_id = result.data[0]['id']
            print(f"✓ Found existing Dr. DeMartino document: {doc_id}")
            print("  Refreshing chunks...")

            # Delete existing chunks to refresh
            client.table('document_chunks').delete().eq(
                'document_id', doc_id
            ).execute()
        else:
            # Create new document
            doc_result = client.table('documents').insert({
                'user_id': admin_user_id,
                'filename': 'Dr_Rob_DeMartino_Professional_Profile.txt',
                'file_type': 'ip_material',
                'mime_type': 'text/plain',
                'title': 'Dr. Rob DeMartino - Creator of BFM Health System',
                'body_system': 'multi_system',
                'document_category': 'reference',
                'role_scope': 'clinical',
                'is_global': True,
                'status': 'indexed',
            }).execute()

            doc_id = doc_result.data[0]['id']
            print(f"✓ Created new Dr. DeMartino document: {doc_id}")

        # Generate embeddings and create chunks
        print(f"\nGenerating embeddings and creating {len(DR_DEMARTINO_CHUNKS)} chunks...")

        for chunk_index, chunk_data in enumerate(DR_DEMARTINO_CHUNKS, 1):
            # Generate embedding for this chunk
            embedding = await get_embedding(chunk_data['content'])

            # Insert chunk with embedding
            client.table('document_chunks').insert({
                'document_id': doc_id,
                'chunk_index': chunk_index,
                'content': chunk_data['content'],
                'embedding': embedding,
                'token_count': len(chunk_data['content'].split()),
                'metadata': {
                    'source': 'Dr. Rob DeMartino Professional Information',
                    'title': chunk_data['title'],
                    'type': 'professional_reference'
                }
            }).execute()

            print(f"  ✓ Chunk {chunk_index}/{len(DR_DEMARTINO_CHUNKS)}: {chunk_data['title']}")

        # Update document total_chunks
        client.table('documents').update({
            'total_chunks': len(DR_DEMARTINO_CHUNKS),
            'status': 'indexed'
        }).eq('id', doc_id).execute()

        print(f"\n✅ Successfully ingested Dr. Rob DeMartino's information!")
        print(f"   Document ID: {doc_id}")
        print(f"   Total chunks: {len(DR_DEMARTINO_CHUNKS)}")
        print(f"\n   Dr. DeMartino's information is now available to the RAG system.")
        print(f"   The system can now provide context about:")
        print(f"   - Dr. DeMartino's background and credentials")
        print(f"   - BFM clinical philosophy and methodology")
        print(f"   - Superior Health Solutions practice")
        print(f"   - Beyond Functional Medicine coaching programs")
        print(f"   - BFM frequency protocol categories")

    except Exception as e:
        print(f"❌ Error ingesting Dr. DeMartino's information: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(ingest_dr_demartino_knowledge())
