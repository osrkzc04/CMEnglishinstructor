/**
 * Seed de preguntas SINTÉTICAS para previsualizar la UI del placement test
 * mientras se completa el banco real.
 *
 * Genera 22 preguntas (16 MC + 6 FILL) por cada nivel CEFR de inglés. Las
 * preguntas quedan marcadas con `topic = "dev-fixture"` para poder
 * identificarlas y borrarlas sin tocar el banco real:
 *
 *   await prisma.question.deleteMany({ where: { topic: "dev-fixture" } })
 *
 * O bien, con el wipe completo: `pnpm tsx scripts/wipe-questions.ts`.
 *
 * Idempotencia: por nivel, si la cantidad de fixtures activos coincide con la
 * esperada se saltea; si difiere, se borran los fixtures previos del nivel y
 * se reinsertan. Así un cambio en este archivo se aplica con solo correr el
 * script de nuevo, sin acumular duplicados.
 *
 * Ejecución:
 *   pnpm db:seed:dev-questions
 *
 * NO ejecutar en producción — son contenidos triviales pensados solo para
 * navegar la UI del candidato extremo a extremo.
 */

import { PrismaClient, QuestionType, Role } from "@prisma/client"

const DEV_FIXTURE_TOPIC = "dev-fixture"
const ENGLISH_CODE = "en"
const MC_PER_LEVEL = 16
const FILL_PER_LEVEL = 6
const TOTAL_PER_LEVEL = MC_PER_LEVEL + FILL_PER_LEVEL

const prisma = new PrismaClient()

// ----------------------------------------------------------------------------
//  Contenido por nivel — pensado para que la UI muestre prompts plausibles y
//  variados, no para validar habilidad real. La gradación de dificultad es
//  aproximativa; el banco real lo definirá Carolina.
// ----------------------------------------------------------------------------

type Mc = { prompt: string; correct: string; distractors: [string, string, string] }
type Fill = { prompt: string; answers: string[]; caseSensitive?: boolean }

const MC_BY_LEVEL: Record<string, Mc[]> = {
  A1: [
    { prompt: "I ___ a teacher.", correct: "am", distractors: ["is", "are", "be"] },
    { prompt: "She ___ from Spain.", correct: "is", distractors: ["am", "are", "be"] },
    { prompt: "They ___ my friends.", correct: "are", distractors: ["is", "am", "be"] },
    { prompt: "We ___ students at the school.", correct: "are", distractors: ["is", "am", "be"] },
    { prompt: "What is your ___?", correct: "name", distractors: ["age", "country", "job"] },
    { prompt: "How ___ are you?", correct: "old", distractors: ["tall", "much", "many"] },
    {
      prompt: "He ___ coffee every morning.",
      correct: "drinks",
      distractors: ["drink", "drinking", "drank"],
    },
    { prompt: "I have ___ apple in my bag.", correct: "an", distractors: ["a", "the", "some"] },
    { prompt: "The book is ___ the table.", correct: "on", distractors: ["in", "at", "to"] },
    { prompt: "She lives ___ Madrid.", correct: "in", distractors: ["on", "at", "by"] },
    { prompt: "What color ___ your car?", correct: "is", distractors: ["are", "am", "do"] },
    {
      prompt: "Can you ___ English?",
      correct: "speak",
      distractors: ["speaks", "speaking", "spoke"],
    },
    {
      prompt: "There ___ a cat under the chair.",
      correct: "is",
      distractors: ["are", "am", "be"],
    },
    {
      prompt: "How many ___ are in your family?",
      correct: "people",
      distractors: ["person", "peoples", "persons"],
    },
    {
      prompt: "I ___ like coffee in the morning.",
      correct: "don't",
      distractors: ["doesn't", "not", "no"],
    },
    {
      prompt: "She ___ TV every night.",
      correct: "watches",
      distractors: ["watch", "watching", "watched"],
    },
  ],

  A2: [
    {
      prompt: "Yesterday I ___ to the cinema with my brother.",
      correct: "went",
      distractors: ["go", "going", "goes"],
    },
    {
      prompt: "She has ___ to New York three times.",
      correct: "been",
      distractors: ["gone", "go", "was"],
    },
    {
      prompt: "If it ___ tomorrow, I will stay home.",
      correct: "rains",
      distractors: ["rain", "will rain", "rained"],
    },
    {
      prompt: "He is ___ than his brother.",
      correct: "taller",
      distractors: ["tall", "more tall", "tallest"],
    },
    {
      prompt: "When ___ you born?",
      correct: "were",
      distractors: ["was", "are", "did"],
    },
    {
      prompt: "She ___ visit her grandmother on Sundays when she was a child.",
      correct: "used to",
      distractors: ["uses to", "use to", "using to"],
    },
    {
      prompt: "I ___ TV when the phone rang.",
      correct: "was watching",
      distractors: ["watch", "watched", "am watching"],
    },
    {
      prompt: "Don't worry, I ___ help you with that.",
      correct: "will",
      distractors: ["am", "would", "can to"],
    },
    {
      prompt: "Have you ___ tried sushi?",
      correct: "ever",
      distractors: ["never", "always", "just"],
    },
    {
      prompt: "There ___ many people at the party last night.",
      correct: "were",
      distractors: ["was", "are", "is"],
    },
    {
      prompt: "She speaks English ___ than I do.",
      correct: "better",
      distractors: ["more better", "gooder", "well"],
    },
    {
      prompt: "I have lived in this city ___ 2020.",
      correct: "since",
      distractors: ["for", "from", "in"],
    },
    {
      prompt: "We ___ leave now if we want to catch the train.",
      correct: "must",
      distractors: ["should to", "ought", "may"],
    },
    {
      prompt: "The car ___ by my father last week.",
      correct: "was bought",
      distractors: ["bought", "buys", "is bought"],
    },
    {
      prompt: "Look! It ___ snowing outside.",
      correct: "is",
      distractors: ["was", "be", "are"],
    },
    {
      prompt: "I'd like ___ cup of tea, please.",
      correct: "a",
      distractors: ["an", "the", "some"],
    },
  ],

  B1: [
    {
      prompt: "By the time we arrived, the movie ___ already started.",
      correct: "had",
      distractors: ["has", "was", "did"],
    },
    {
      prompt: "If I ___ rich, I would travel the world.",
      correct: "were",
      distractors: ["am", "be", "will be"],
    },
    {
      prompt: "She suggested that we ___ early to avoid traffic.",
      correct: "leave",
      distractors: ["leaves", "left", "leaving"],
    },
    {
      prompt: "The book ___ I borrowed was excellent.",
      correct: "that",
      distractors: ["what", "who", "whose"],
    },
    {
      prompt: "I wish I ___ more free time these days.",
      correct: "had",
      distractors: ["have", "will have", "would have"],
    },
    {
      prompt: "Despite ___ tired, he finished the report.",
      correct: "being",
      distractors: ["be", "was", "is"],
    },
    {
      prompt: "It's too cold ___ swim today.",
      correct: "to",
      distractors: ["for", "of", "that"],
    },
    {
      prompt: "He denied ___ the money.",
      correct: "stealing",
      distractors: ["to steal", "stole", "steals"],
    },
    {
      prompt: "I'm used to ___ early in the morning.",
      correct: "waking up",
      distractors: ["wake up", "woke up", "wakes up"],
    },
    {
      prompt: "By next year, she ___ here for ten years.",
      correct: "will have lived",
      distractors: ["will live", "has lived", "lived"],
    },
    {
      prompt: "Neither John ___ Mary came to the meeting.",
      correct: "nor",
      distractors: ["or", "and", "but"],
    },
    {
      prompt: "The meeting was ___ off because of bad weather.",
      correct: "called",
      distractors: ["made", "put", "taken"],
    },
    {
      prompt: "She doesn't enjoy ___ to loud music.",
      correct: "listening",
      distractors: ["listen", "to listen", "listens"],
    },
    {
      prompt: "I'd rather you ___ smoke here.",
      correct: "didn't",
      distractors: ["don't", "wouldn't", "not"],
    },
    {
      prompt: "He ___ working here since 2018.",
      correct: "has been",
      distractors: ["is", "was", "have been"],
    },
    {
      prompt: "Could you tell me where ___?",
      correct: "the station is",
      distractors: ["is the station", "the station does", "does the station"],
    },
  ],

  B2: [
    {
      prompt: "By next summer, the building ___ for over a decade.",
      correct: "will have stood",
      distractors: ["will stand", "has stood", "stood"],
    },
    {
      prompt: "Were it not ___ your help, we would have failed.",
      correct: "for",
      distractors: ["to", "with", "of"],
    },
    {
      prompt: "Scarcely ___ the door when someone knocked.",
      correct: "had I closed",
      distractors: ["I had closed", "did I close", "I closed"],
    },
    {
      prompt: "He came across ___ rude during the interview.",
      correct: "as",
      distractors: ["for", "like", "in"],
    },
    {
      prompt: "Provided that you ___ time, would you help me revise?",
      correct: "have",
      distractors: ["had", "will have", "would have"],
    },
    {
      prompt: "She regretted ___ him about the surprise.",
      correct: "telling",
      distractors: ["to tell", "tell", "told"],
    },
    {
      prompt: "I object ___ being kept waiting like this.",
      correct: "to",
      distractors: ["at", "for", "with"],
    },
    {
      prompt: "The proposal is ___ further consideration.",
      correct: "worth",
      distractors: ["worthy", "worthwhile to", "worthy of"],
    },
    {
      prompt: "He is said ___ a fortune in property.",
      correct: "to have made",
      distractors: ["to make", "having made", "to be making"],
    },
    {
      prompt: "Not until much later ___ what had really happened.",
      correct: "did I realise",
      distractors: ["I realised", "I had realised", "realised I"],
    },
    {
      prompt: "If only she ___ accepted the offer when she had the chance.",
      correct: "had",
      distractors: ["has", "would have", "would"],
    },
    {
      prompt: "It was ___ a difficult question that nobody could answer.",
      correct: "such",
      distractors: ["so", "too", "very"],
    },
    {
      prompt: "He insisted ___ paying for the entire meal.",
      correct: "on",
      distractors: ["in", "at", "for"],
    },
    {
      prompt: "The committee ___ to a unanimous decision after hours of debate.",
      correct: "came",
      distractors: ["got", "took", "reached at"],
    },
    {
      prompt: "Hardly anyone ___ aware of the change in policy.",
      correct: "was",
      distractors: ["were", "have been", "is being"],
    },
    {
      prompt: "I'd appreciate ___ as soon as possible.",
      correct: "it if you replied",
      distractors: ["you replying", "that you reply", "you to reply"],
    },
  ],

  C1: [
    {
      prompt: "Little ___ that the project would face so many obstacles.",
      correct: "did we anticipate",
      distractors: ["we anticipated", "we did anticipate", "had we anticipated"],
    },
    {
      prompt: "The new policy is ___ to face resistance from the union.",
      correct: "bound",
      distractors: ["sure of", "obliged", "compelled"],
    },
    {
      prompt: "Were the situation ___ deteriorate, immediate action would be required.",
      correct: "to",
      distractors: ["would", "should", "may"],
    },
    {
      prompt: "She is widely ___ to be the leading expert in her field.",
      correct: "considered",
      distractors: ["regarded as", "thought as", "viewed"],
    },
    {
      prompt: "Hardly had the meeting begun ___ a fierce argument broke out.",
      correct: "when",
      distractors: ["than", "then", "and"],
    },
    {
      prompt: "His remarks were ___ contradictory.",
      correct: "patently",
      distractors: ["patent", "patentness", "patentually"],
    },
    {
      prompt: "She made the announcement ___ much resistance from her colleagues.",
      correct: "in the face of",
      distractors: ["in face of", "facing of", "in front of"],
    },
    {
      prompt: "I would sooner you ___ such things in front of the children.",
      correct: "didn't say",
      distractors: ["don't say", "wouldn't say", "not say"],
    },
    {
      prompt: "The minister's resignation ___ a great deal of speculation.",
      correct: "gave rise to",
      distractors: ["arose to", "raised to", "gave way to"],
    },
    {
      prompt: "Far from ___, the criticism was completely justified.",
      correct: "being unfair",
      distractors: ["unfair", "be unfair", "to be unfair"],
    },
    {
      prompt: "He has a tendency ___ in absolutes.",
      correct: "to think",
      distractors: ["thinking", "for thinking", "to thinking"],
    },
    {
      prompt: "The plan was ___ from the start.",
      correct: "doomed to fail",
      distractors: ["doomed failing", "doom to fail", "doomed for failure"],
    },
    {
      prompt: "On no account ___ this document to unauthorised personnel.",
      correct: "should you show",
      distractors: ["you should show", "you must show", "would you show"],
    },
    {
      prompt: "The agreement is contingent ___ ratification by the board.",
      correct: "upon",
      distractors: ["with", "for", "to"],
    },
    {
      prompt: "Such ___ his anger that he left the room without a word.",
      correct: "was",
      distractors: ["were", "had been", "did"],
    },
    {
      prompt: "We are ___ a critical juncture in negotiations.",
      correct: "at",
      distractors: ["in", "on", "by"],
    },
  ],

  C2: [
    {
      prompt: "Not for one moment ___ that the deal would collapse.",
      correct: "did I imagine",
      distractors: ["I imagined", "I had imagined", "imagined I"],
    },
    {
      prompt: "The findings ___ a wholesale revision of long-held assumptions.",
      correct: "necessitate",
      distractors: ["necessarily", "make necessity of", "are necessary"],
    },
    {
      prompt: "His proposal, while ___ on the surface, raises serious concerns.",
      correct: "compelling",
      distractors: ["compel", "compelled", "compulsion"],
    },
    {
      prompt: "She approached the task ___ undue haste.",
      correct: "without",
      distractors: ["with no", "lacking of", "free from"],
    },
    {
      prompt: "Inasmuch ___ the report is preliminary, its conclusions warrant caution.",
      correct: "as",
      distractors: ["like", "that", "than"],
    },
    {
      prompt: "The merger has been postponed pending ___ of the regulator.",
      correct: "the approval",
      distractors: ["approval", "to approve", "approving"],
    },
    {
      prompt: "His prose is, if ___, more elegant than that of his contemporaries.",
      correct: "anything",
      distractors: ["nothing", "something", "everything"],
    },
    {
      prompt: "The decision was made ___ the express wishes of the committee.",
      correct: "against",
      distractors: ["beside", "alongside", "regardless"],
    },
    {
      prompt: "She is nothing ___ a perfectionist when it comes to her work.",
      correct: "if not",
      distractors: ["but", "only", "less than"],
    },
    {
      prompt: "Be that ___, the deadline cannot be extended.",
      correct: "as it may",
      distractors: ["as may", "though it is", "however"],
    },
    {
      prompt: "The court ruled that the evidence was ___ inadmissible.",
      correct: "wholly",
      distractors: ["wholeness", "whole", "wholy"],
    },
    {
      prompt: "Suffice ___ to say, the outcome surprised everyone present.",
      correct: "it",
      distractors: ["us", "for", "that"],
    },
    {
      prompt: "The investigation has yet ___ any conclusive evidence.",
      correct: "to yield",
      distractors: ["yielding", "yielded", "yield"],
    },
    {
      prompt: "He spoke with a candour ___ of a much younger man.",
      correct: "characteristic",
      distractors: ["character", "characterised", "characterising"],
    },
    {
      prompt: "There can be no question ___ his commitment to the cause.",
      correct: "of",
      distractors: ["about", "from", "with"],
    },
    {
      prompt: "Notwithstanding ___ misgivings, the board approved the merger.",
      correct: "its",
      distractors: ["it has", "of having", "to have"],
    },
  ],
}

const FILL_BY_LEVEL: Record<string, Fill[]> = {
  A1: [
    { prompt: "Complete: I ___ from Ecuador. (verb to be)", answers: ["am"] },
    { prompt: "What is the plural form of 'child'?", answers: ["children"] },
    { prompt: "The opposite of 'hot' is ___ (one word).", answers: ["cold"] },
    { prompt: "What is the capital city of France?", answers: ["Paris"] },
    {
      prompt: "Days of the week: Monday, Tuesday, ___ (Wed-).",
      answers: ["Wednesday"],
    },
    { prompt: "Color of the sky on a clear day (one word):", answers: ["blue"] },
  ],

  A2: [
    { prompt: "Write the simple past tense of 'go':", answers: ["went"] },
    { prompt: "Write the simple past tense of 'eat':", answers: ["ate"] },
    { prompt: "Comparative form of the adjective 'good':", answers: ["better"] },
    { prompt: "Superlative form of the adjective 'bad':", answers: ["worst", "the worst"] },
    { prompt: "Plural of 'foot' (one word):", answers: ["feet"] },
    {
      prompt: "Complete the preposition: I'm interested ___ classical music.",
      answers: ["in"],
    },
  ],

  B1: [
    { prompt: "Past participle of the verb 'write':", answers: ["written"] },
    { prompt: "Antonym of 'expensive' (one word):", answers: ["cheap", "inexpensive"] },
    {
      prompt: "Complete the preposition: It depends ___ the situation.",
      answers: ["on"],
    },
    { prompt: "Past tense of the irregular verb 'bring':", answers: ["brought"] },
    {
      prompt: "Provide a synonym of 'famous' (one word):",
      answers: ["renowned", "well-known", "well known"],
    },
    { prompt: "Past perfect form of 'see' (two words):", answers: ["had seen"] },
  ],

  B2: [
    {
      prompt: "Phrasal verb meaning 'to tolerate', starting with 'put': put ___ with",
      answers: ["up"],
    },
    {
      prompt: "Complete the idiom: 'a piece of ___' (something very easy).",
      answers: ["cake"],
    },
    { prompt: "Past participle of the irregular verb 'sink':", answers: ["sunk", "sunken"] },
    {
      prompt: "Complete: She accused him ___ lying about his whereabouts.",
      answers: ["of"],
    },
    {
      prompt: "Word formation: noun derived from 'decide' (one word).",
      answers: ["decision"],
    },
    {
      prompt: "Complete: I'm looking forward ___ hearing from you.",
      answers: ["to"],
    },
  ],

  C1: [
    {
      prompt: "Complete the idiom: 'to bite the ___' (to accept something unpleasant).",
      answers: ["bullet"],
    },
    {
      prompt: "Adjective derived from the noun 'controversy' (one word).",
      answers: ["controversial"],
    },
    {
      prompt: "Complete: The new measures will be brought ___ effect next month.",
      answers: ["into"],
    },
    {
      prompt: "Phrasal verb meaning 'to disappoint': to let someone ___",
      answers: ["down"],
    },
    {
      prompt: "Word formation: abstract noun from 'genuine' (one word).",
      answers: ["genuineness"],
    },
    {
      prompt: "Complete: The decision is ___ ratification by the board.",
      answers: ["pending", "subject to"],
    },
  ],

  C2: [
    {
      prompt: "Complete the idiom: 'to throw caution to the ___'.",
      answers: ["wind", "winds"],
    },
    {
      prompt: "Adjective meaning 'extremely careful and precise' (starts with 'm').",
      answers: ["meticulous"],
    },
    {
      prompt: "Complete: The findings have far-reaching ___ for public policy.",
      answers: ["implications", "consequences"],
    },
    {
      prompt: "Word formation: adjective from 'irreparable' antonym (one word).",
      answers: ["reparable"],
    },
    {
      prompt: "Complete the collocation: 'to ___ a precedent' (set, establish).",
      answers: ["set", "establish"],
    },
    {
      prompt: "Phrasal verb meaning 'to retract a statement': to take it ___",
      answers: ["back"],
    },
  ],
}

// ----------------------------------------------------------------------------
//  Main
// ----------------------------------------------------------------------------

async function main() {
  console.log("🌱 Sembrando preguntas DEV (banco sintético)\n")

  // 1) Resolver idioma e niveles CEFR del inglés.
  const english = await prisma.language.findUnique({ where: { code: ENGLISH_CODE } })
  if (!english) {
    throw new Error(
      `Idioma "${ENGLISH_CODE}" no existe. Corre 'pnpm db:seed' antes para sembrar el catálogo.`,
    )
  }
  const levels = await prisma.cefrLevel.findMany({
    where: { languageId: english.id },
    orderBy: { order: "asc" },
  })
  if (levels.length === 0) {
    throw new Error("No hay niveles CEFR cargados. Corre 'pnpm db:seed' antes.")
  }

  // 2) Resolver un usuario creador (DIRECTOR/COORDINATOR — para `createdBy`).
  const creator = await prisma.user.findFirst({
    where: { role: { in: [Role.DIRECTOR, Role.COORDINATOR] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, role: true },
  })
  if (!creator) {
    throw new Error(
      "No hay usuarios DIRECTOR/COORDINATOR. Corre 'pnpm db:seed' antes para sembrar la directora demo.",
    )
  }
  console.log(`  Creador: ${creator.email} (${creator.role})\n`)

  // 3) Por cada nivel, asegurar exactamente TOTAL_PER_LEVEL fixtures.
  let totalCreated = 0
  let totalSkipped = 0
  let totalReplaced = 0

  for (const level of levels) {
    const code = level.code
    const mcs = MC_BY_LEVEL[code]
    const fills = FILL_BY_LEVEL[code]
    if (!mcs || !fills) {
      console.log(`  ⚠️  ${code}: sin contenido definido — saltando`)
      continue
    }
    if (mcs.length !== MC_PER_LEVEL || fills.length !== FILL_PER_LEVEL) {
      throw new Error(
        `Inconsistencia en ${code}: se esperan ${MC_PER_LEVEL} MC y ${FILL_PER_LEVEL} FILL, ` +
          `hay ${mcs.length} MC y ${fills.length} FILL.`,
      )
    }

    const existingCount = await prisma.question.count({
      where: { levelId: level.id, topic: DEV_FIXTURE_TOPIC },
    })

    if (existingCount === TOTAL_PER_LEVEL) {
      console.log(`  ↷ ${code}: ya tiene ${TOTAL_PER_LEVEL} fixtures — saltando`)
      totalSkipped += TOTAL_PER_LEVEL
      continue
    }

    if (existingCount > 0) {
      // Limpieza previa: borra fixtures viejos del nivel antes de reinsertar.
      // El cascade del schema borra QuestionOption / QuestionFillAnswer.
      const removed = await prisma.question.deleteMany({
        where: { levelId: level.id, topic: DEV_FIXTURE_TOPIC },
      })
      console.log(`  ✂  ${code}: removidos ${removed.count} fixtures previos`)
      totalReplaced += removed.count
    }

    // Inserts secuenciales (no transaccionados — es un script local).
    for (const mc of mcs) {
      await prisma.question.create({
        data: {
          levelId: level.id,
          type: QuestionType.MULTIPLE_CHOICE,
          prompt: mc.prompt,
          topic: DEV_FIXTURE_TOPIC,
          points: 1,
          isActive: true,
          createdBy: creator.id,
          options: {
            create: [
              { text: mc.correct, isCorrect: true, order: 0 },
              { text: mc.distractors[0], isCorrect: false, order: 1 },
              { text: mc.distractors[1], isCorrect: false, order: 2 },
              { text: mc.distractors[2], isCorrect: false, order: 3 },
            ],
          },
        },
      })
    }

    for (const fill of fills) {
      await prisma.question.create({
        data: {
          levelId: level.id,
          type: QuestionType.FILL_IN,
          prompt: fill.prompt,
          topic: DEV_FIXTURE_TOPIC,
          points: 1,
          isActive: true,
          createdBy: creator.id,
          fillAnswers: {
            create: fill.answers.map((answer) => ({
              acceptedAnswer: answer,
              caseSensitive: fill.caseSensitive ?? false,
            })),
          },
        },
      })
    }

    totalCreated += TOTAL_PER_LEVEL
    console.log(`  ✓ ${code}: ${TOTAL_PER_LEVEL} fixtures sembrados (${MC_PER_LEVEL} MC + ${FILL_PER_LEVEL} FILL)`)
  }

  console.log("")
  console.log(`✅ Fixtures listos:`)
  console.log(`     creados:    ${totalCreated}`)
  console.log(`     saltados:   ${totalSkipped}`)
  console.log(`     reemplazos: ${totalReplaced}`)
  console.log(`\n  Para borrar solo los fixtures dev:`)
  console.log(`     pnpm prisma -- studio   (filtrar topic="${DEV_FIXTURE_TOPIC}")`)
  console.log(`  o ejecutar:`)
  console.log(
    `     prisma.question.deleteMany({ where: { topic: "${DEV_FIXTURE_TOPIC}" } })`,
  )
}

main()
  .catch((err) => {
    console.error("\n✗ Error:", err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
