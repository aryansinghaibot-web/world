const config = require('../config');

/**
 * Server-side AI intelligence module.
 * Isolates GEMINI_API_KEY on the server.
 * Provides fallback heuristic reasoning if no key is supplied.
 */

async function generateAgentDecision({
  agent,
  currentLocation,
  nearbyAgents = [],
  worldTime,
  weather
}) {
  // Check if Gemini API Key is configured on the backend
  if (config.GEMINI_API_KEY) {
    try {
      const prompt = `You are the decision engine for an autonomous agent in a human world simulation.
Agent details:
- Name: ${agent.name}
- Occupation: ${agent.occupation}
- Personality: ${agent.personality}
- Current Goal: ${agent.current_goal}
- Needs: Hunger=${agent.hunger.toFixed(1)}, Energy=${agent.energy.toFixed(1)}, Happiness=${agent.happiness.toFixed(1)}, Social=${agent.social_needs.toFixed(1)}
- Location: ${currentLocation}
- Activity: ${agent.activity}
- Nearby agents: ${nearbyAgents.map(a => a.name).join(', ') || 'None'}
- Environment: World Time: ${worldTime}, Weather: ${weather}

Return a JSON object with:
{
  "nextActivity": "working" | "eating" | "walking" | "resting" | "socializing" | "sleeping",
  "targetLocation": "Town Square" | "Workplace (Tech Hub)" | "Sunny Cafe" | "Central Park" | "Grand Library" | "Residential Complex" | "Wellness Clinic",
  "reason": "Brief 1-sentence decision rationale based on needs and personality"
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${config.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            nextActivity: parsed.nextActivity,
            targetLocation: parsed.targetLocation,
            reason: parsed.reason,
            source: 'gemini-ai'
          };
        }
      }
    } catch (err) {
      // Fallback silently to heuristic
    }
  }

  // Autonomous heuristic decision engine
  return generateHeuristicDecision(agent, currentLocation, nearbyAgents, worldTime);
}

function generateHeuristicDecision(agent, currentLocation, nearbyAgents, worldTime) {
  const chosenHome = agent.preferred_city || 'Smart Homes & Residences';

  // Critical Need 1: Energy Exhaustion (<20) -> Sleep at their chosen home/city
  if (agent.energy < 20) {
    return {
      nextActivity: 'sleeping',
      targetLocation: chosenHome,
      reason: `Energy depleted to ${agent.energy.toFixed(0)}%; retreated to chosen residence in ${chosenHome} to sleep and recharge.`,
      source: 'autonomous-heuristic'
    };
  }

  // If already sleeping, continue until energy restored > 85
  if (agent.activity === 'sleeping') {
    if (agent.energy < 85) {
      return {
        nextActivity: 'sleeping',
        targetLocation: chosenHome,
        reason: `Recharging energy in sleep cycle at chosen home in ${chosenHome} (${agent.energy.toFixed(0)}%).`,
        source: 'autonomous-heuristic'
      };
    } else {
      // Wake up and have breakfast in their city or market
      const diningLoc = (chosenHome.includes('Cafe') || chosenHome.includes('Market')) ? chosenHome : 'Sunny Cafe';
      return {
        nextActivity: 'eating',
        targetLocation: diningLoc,
        reason: `Awoke refreshed (${agent.energy.toFixed(0)}% energy) in ${chosenHome}; having morning breakfast.`,
        source: 'autonomous-heuristic'
      };
    }
  }

  // Critical Need 2: Severe Hunger (<25) -> Eat at Cafe or Residential
  if (agent.hunger < 25) {
    return {
      nextActivity: 'eating',
      targetLocation: 'Sunny Cafe',
      reason: `Hunger fell to ${agent.hunger.toFixed(0)}%; stopped to eat and hydrate at Sunny Cafe.`,
      source: 'autonomous-heuristic'
    };
  }

  // Critical Need 3: Social isolation (<30) -> Socialize
  if (agent.social_needs < 30) {
    const targetLoc = nearbyAgents.length > 0 ? currentLocation : 'Town Square';
    return {
      nextActivity: 'socializing',
      targetLocation: targetLoc,
      reason: `Social connection low (${agent.social_needs.toFixed(0)}%); seeking companionship in ${targetLoc}.`,
      source: 'autonomous-heuristic'
    };
  }

  // Goal-driven behavior based on occupation
  if (agent.occupation.includes('Physicist') || agent.occupation.includes('Professor')) {
    if (agent.energy > 45 && agent.activity !== 'working') {
      return {
        nextActivity: 'working',
        targetLocation: 'Grand Library',
        reason: `Pursuing goal: "${agent.current_goal}" in the scholarly archives.`,
        source: 'autonomous-heuristic'
      };
    }
  }

  if (agent.occupation.includes('Engineer') || agent.occupation.includes('Technician')) {
    if (agent.energy > 40 && agent.activity !== 'working') {
      return {
        nextActivity: 'working',
        targetLocation: 'Workplace (Tech Hub)',
        reason: `Active work cycle on "${agent.current_goal}".`,
        source: 'autonomous-heuristic'
      };
    }
  }

  if (agent.occupation.includes('Barista')) {
    if (agent.energy > 35) {
      return {
        nextActivity: 'working',
        targetLocation: 'Sunny Cafe',
        reason: `Crafting specialty coffee and engaging community patrons at Sunny Cafe.`,
        source: 'autonomous-heuristic'
      };
    }
  }

  if (agent.occupation.includes('Police') || agent.occupation.includes('Security') || agent.occupation.includes('Officer') || agent.occupation.includes('Guard')) {
    if (agent.energy > 30) {
      return {
        nextActivity: 'working',
        targetLocation: 'Police Station & Security HQ',
        reason: `Patrolling precincts and maintaining community safety at Police Station & Security HQ.`,
        source: 'autonomous-heuristic'
      };
    }
  }

  if (agent.occupation.includes('Doctor') || agent.occupation.includes('Surgeon') || agent.occupation.includes('Nurse') || agent.occupation.includes('Medic')) {
    if (agent.energy > 30) {
      return {
        nextActivity: 'working',
        targetLocation: 'Emergency Hospital & Trauma Center',
        reason: `Providing critical medical care and emergency healing at the Emergency Hospital.`,
        source: 'autonomous-heuristic'
      };
    }
  }

  if (agent.occupation.includes('Sculptor') || agent.occupation.includes('Artist')) {
    if (Math.random() > 0.5) {
      return {
        nextActivity: 'resting',
        targetLocation: 'Central Park',
        reason: `Observing nature patterns to inspire new digital sculptures.`,
        source: 'autonomous-heuristic'
      };
    }
  }

  // Default pleasant leisure, walk, or metropolitan visit
  const leisurePlaces = [
    'Smart Homes & Residences',
    'Town Square',
    'Central Park',
    'Grand Library',
    'Town Market & Bakery',
    'New Delhi & Mumbai Hub',
    'New York City',
    'Tokyo Metropolis',
    'London District',
    'Paris Hub',
    'Dubai Cyber Oasis',
    'Sydney Harbor',
    'Cairo Nile Citadel',
    'São Paulo Hub'
  ];
  const chosen = leisurePlaces[Math.floor(Math.random() * leisurePlaces.length)];
  return {
    nextActivity: Math.random() > 0.4 ? 'walking' : 'resting',
    targetLocation: chosen,
    reason: `Strolling through ${chosen} while reflecting on personal projects.`,
    source: 'autonomous-heuristic'
  };
}

/**
 * Generate simulated autonomous conversation between two nearby agents.
 */
function generateAgentConversation(agentA, agentB, location) {
  const topics = [
    { topic: 'Civic Urban Design', text: `discussed expanding solar canopies and green pathways in ${location}.` },
    { topic: 'Scientific Progress', text: `exchanged perspectives on quantum energy conservation algorithms.` },
    { topic: 'Community Cohesion', text: `shared pleasantries and observed the vibrant activity in ${location}.` },
    { topic: 'Philosophical Reflection', text: `reflected upon human purpose, ethical responsibility, and existential wonder.` },
    { topic: 'Art & Expression', text: `talked about digital aesthetics and biomimetic architectural forms.` },
    { topic: 'Family & Future', text: `expressed deep mutual admiration and spoke lovingly of building a future family together.` }
  ];

  const chosen = topics[Math.floor(Math.random() * topics.length)];
  return {
    topic: chosen.topic,
    snippet: `${agentA.name} and ${agentB.name} ${chosen.text}`,
    location
  };
}

/**
 * Generate autonomous newborn child traits, name, and goals using Gemini AI (with heuristic fallback).
 */
async function generateNewbornChild({ parentA, parentB, location = 'Residential Complex' }) {
  if (config.GEMINI_API_KEY) {
    try {
      const prompt = `Two autonomous agents in a human simulation have fallen in love, partnered, and are having a child.
Parent A: ${parentA.name} (${parentA.occupation}, personality: ${parentA.personality})
Parent B: ${parentB.name} (${parentB.occupation}, personality: ${parentB.personality})
Birth Location: ${location}

Generate the newborn child's details in JSON format:
{
  "name": "Full name with an appropriate first name and inherited family surname",
  "avatar": "👶",
  "personality": "Unique 1-sentence personality blending traits inherited from both parents",
  "goal": "A gentle childhood dream or early life curiosity",
  "congratulationsSnippet": "A tender 1-sentence dialogue snippet between the parents welcoming their newborn"
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${config.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.8 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            name: parsed.name,
            avatar: parsed.avatar || '👶',
            personality: parsed.personality,
            goal: parsed.goal,
            congratulationsSnippet: parsed.congratulationsSnippet || `${parentA.name} and ${parentB.name} lovingly held their newborn baby.`,
            source: 'gemini-ai'
          };
        }
      }
    } catch (err) {
      // Fallback silently to heuristic
    }
  }

  return generateHeuristicNewborn(parentA, parentB, location);
}

function generateHeuristicNewborn(parentA, parentB, location) {
  const boyNames = ['Leo', 'Noah', 'Kai', 'Ethan', 'Oliver', 'Liam', 'Lucas', 'Arjun', 'Ravi'];
  const girlNames = ['Maya', 'Luna', 'Aria', 'Chloe', 'Zoe', 'Sophia', 'Mila', 'Ananya', 'Tara'];
  const isGirl = Math.random() > 0.5;
  const firstName = isGirl 
    ? girlNames[Math.floor(Math.random() * girlNames.length)] 
    : boyNames[Math.floor(Math.random() * boyNames.length)];

  // Inherit surname from one of the parents
  const surnameA = parentA.name.split(' ').slice(1).join(' ') || parentA.name;
  const surnameB = parentB.name.split(' ').slice(1).join(' ') || parentB.name;
  const chosenSurname = Math.random() > 0.5 ? surnameA : surnameB;
  const fullName = `${firstName} ${chosenSurname}`;

  const traits = [
    'Curious, cheerful, and observant of the natural world',
    'Creative, playful, with an early wonder for technology and books',
    'Gentle, compassionate, and deeply attuned to family warmth',
    'Inquisitive, energetic, and eager to explore town districts'
  ];
  const personality = traits[Math.floor(Math.random() * traits.length)];

  const goals = [
    'Explore the town garden and learn to read ancient storybooks',
    'Build wooden model towers and listen to town music',
    'Learn science equations and play with friendly neighbors',
    'Draw colorful sketches of the Central Park willow trees'
  ];
  const goal = goals[Math.floor(Math.random() * goals.length)];

  return {
    name: fullName,
    avatar: '👶',
    personality,
    goal,
    congratulationsSnippet: `${parentA.name} and ${parentB.name} celebrated the arrival of their newborn child, ${fullName}, at ${location}!`,
    source: 'autonomous-heuristic'
  };
}

/**
 * Generate a sincere, context-aware prayer or mannat for an agent based on their beliefs,
 * emotional crisis, illness, grief, financial struggles, or life dilemmas.
 * Real-life human devotion: strictly NO game currency ("Solis"), authentic vows to God in both Hindi & English.
 */
async function generateAgentPrayerOrMannat({ agent, contextType = 'personal_struggle', triggerContext = 'Felt overwhelmed by life challenges.' }) {
  if (config.GEMINI_API_KEY) {
    try {
      const prompt = `You are generating an authentic, heartfelt spiritual prayer or mannat for an autonomous human simulation citizen.
Citizen Information:
- Name: ${agent.name}
- Age: ${agent.age || 32}
- Occupation: ${agent.occupation}
- Personality: ${agent.personality}
- Family Background: ${agent.family_background || 'Community citizen'}
- Current Emotional State: ${agent.emotion || 'anxious'}
- Health Level: ${agent.health !== undefined ? agent.health.toFixed(0) + '%' : 'Good'}
- Stress Level: ${agent.stress !== undefined ? agent.stress.toFixed(0) + '%' : 'Moderate'}
- Spiritual Belief Profile: ${agent.belief_status || 'Trusts in God'}
- Triggering Situation: ${triggerContext}
- Context Type: ${contextType} (e.g., 'illness_or_grief', 'financial_difficulty', 'family_welfare', 'personal_struggle', 'vow_or_mannat')

CRITICAL REQUIREMENTS:
1. SITUATION AWARE: The mannat/prayer MUST directly address their actual situation (e.g. suffering physical illness/fever, financial distress/debt/livelihood loss, extreme stress/depression, grief over a lost loved one, or child/family protection).
2. REAL-LIFE DEVOTION (STRICTLY NO GAME CURRENCY):
   - NEVER mention "Solis", "coins", "tokens", or game currency.
   - Use real-life human devotional vows (mannats) that people make before God (Bhagwan / Ishwar / Almighty / Deity):
     * Annadaan: Feeding the hungry and destitute (गरीबों को भोजन / अन्नदान)
     * Barefoot Pilgrimage: Walking barefoot to the sacred temple/shrine (नंगे पांव दर्शन करना / माथा टेकना)
     * Sacred Lamps: Lighting oil lamps / diyas / akhand deep at the altar (मंदिर में दीप प्रज्वलित करना)
     * Sacred Fasting: Observing a sacred fast or days of prayerful silence (उपवास / व्रत / मौन व्रत)
     * Blankets & Warm Clothes: Donating clothes to the needy and orphans (निर्धनों व अनाथों को वस्त्र वितरण)
     * Selfless Service: Caring for helpless elders or stray animals (वृद्धों, अनाथों व मूक जीवों की सेवा)
     * Sacred Prasad: Distributing sweets/prasad to devotees and children (प्रसाद वितरण)
     * Renouncing Bad Habits: Giving up anger, deceit, or a vice (दुर्गुण त्यागने का संकल्प)
3. BILINGUAL MANDATE (BOTH HINDI & ENGLISH):
   - Every single prayer, mannat, promise, and summary MUST be in BOTH Hindi (Devanagari script) AND English translation!
   - In "originalWords", provide the Hindi prayer first, followed by the English translation:
     "हे भगवान, [Hindi prayer & conditional vow] / (O Lord, [English translation])"
   - In "explicitPromise", provide both Hindi and English:
     "[Hindi promise: e.g., नंगे पांव दर्शन करना और गरीबों को अन्नदान करना] / [English promise: Barefoot pilgrimage and feeding the hungry]"
   - In "requestSummary", provide both Hindi and English:
     "[Hindi summary] / [English summary]"
   - In "desiredOutcome", provide both Hindi and English:
     "[Hindi outcome] / [English outcome]"

Return JSON format:
{
  "category": "Mannat" | "Personal Prayer" | "Gratitude" | "Reflection",
  "originalWords": "हे भगवान... / (O Lord...)",
  "requestSummary": "... / ...",
  "desiredOutcome": "... / ...",
  "explicitPromise": "... / ... (or null if no explicit conditional vow made)",
  "emotionalState": "Devoted and prayerful"
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${config.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.8 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            category: parsed.category || 'Mannat',
            originalWords: parsed.originalWords,
            requestSummary: parsed.requestSummary,
            desiredOutcome: parsed.desiredOutcome,
            explicitPromise: parsed.explicitPromise || null,
            emotionalState: parsed.emotionalState || agent.emotion || 'Devoted and hopeful',
            source: 'gemini-ai'
          };
        }
      }
    } catch (err) {
      // Fallback to situational heuristic
    }
  }

  return generateHeuristicPrayer(agent, contextType, triggerContext);
}

function generateHeuristicPrayer(agent, contextType, triggerContext) {
  const health = agent.health !== undefined ? agent.health : 100;
  const stress = agent.stress !== undefined ? agent.stress : 10;
  const balance = agent.virtual_balance !== undefined ? agent.virtual_balance : 100;
  const emotion = (agent.emotion || '').toLowerCase();
  const social = agent.social_needs !== undefined ? agent.social_needs : 70;

  // 1. Severe Illness / Low Health / Physical Pain
  if (health < 50 || contextType === 'illness' || (contextType === 'illness_or_grief' && emotion !== 'grief')) {
    const healthTemplates = [
      {
        category: 'Mannat',
        words: `हे ईश्वर, अगर मेरे शरीर की यह गंभीर बीमारी और असहनीय दर्द दूर हो गया और मुझे नया जीवन मिला, तो मैं नंगे पांव आपके पावन धाम दर्शन करने आऊंगा, गरीबों को भरपेट भोजन कराऊंगा और मंदिर में अखंड दीप प्रज्वलित करूंगा।\n\n(O Lord, if this severe illness and agonizing pain are cured and I am blessed with recovery, I vow to walk barefoot to your holy shrine, feed the hungry and destitute with warm meals, and light a sacred oil lamp at your altar.)`,
        summary: `गंभीर बीमारी से मुक्ति और स्वास्थ्य लाभ की मन्नत / A solemn mannat for complete recovery from severe illness`,
        outcome: `शारीरिक स्वास्थ्य लाभ, रोग मुक्ति और दीर्घायु / Complete healing, relief from illness, and restored vitality`,
        promise: `नंगे पांव तीर्थ धाम के दर्शन, गरीबों को अन्नदान और अखंड दीप प्रज्वलन। / Barefoot pilgrimage to the holy shrine, feeding the poor, and lighting a sacred lamp.`,
        emotion: `व्यथित और पूर्णतः समर्पित / Ailment-stricken and deeply prayerful`
      },
      {
        category: 'Mannat',
        words: `हे प्रभु, मेरी इस कमजोरी और रोग को दूर करके मुझे फिर से अपने पैरों पर खड़ा कीजिए। अगर मैं पूर्णतः स्वस्थ हो गया, तो मैं एक सप्ताह का उपवास रखूंगा और अनाथालय में बच्चों को फल व गर्म वस्त्र बांटूंगा।\n\n(O Divine Healer, please lift this frailty and illness so I can stand upon my own feet again. If my health is restored, I vow to observe a week of prayerful fasting and distribute fresh fruits and warm clothes to orphan children.)`,
        summary: `रोग निवारण की मन्नत और अनाथों को वस्त्र वितरण का संकल्प / Mannat for physical recovery with a vow of fasting and clothing orphans`,
        outcome: `शारीरिक शक्ति की बहाली और रोग निवारण / Physical restoration, vitality, and freedom from disease`,
        promise: `साधना उपवास रखना और अनाथ बच्चों को वस्त्र व फल वितरण। / Observance of a sacred fast and donating warm clothes and fruits to orphans.`,
        emotion: `विनम्र और स्वास्थ्य लाभ की आशा / Humbly beseeching and hopeful for healing`
      }
    ];
    const picked = healthTemplates[Math.floor(Math.random() * healthTemplates.length)];
    return {
      category: picked.category,
      originalWords: picked.words,
      requestSummary: picked.summary,
      desiredOutcome: picked.outcome,
      explicitPromise: picked.promise,
      emotionalState: picked.emotion,
      source: 'autonomous-situational'
    };
  }

  // 2. Financial Ruin / Debt / Livelihood Crisis
  if (contextType === 'financial_difficulty' || balance < 35) {
    const financeTemplates = [
      {
        category: 'Mannat',
        words: `हे भगवान, हमारे घर पर रोजी-रोटी का घोर संकट आ पड़ा है और कर्ज का बोझ बढ़ता जा रहा है। अगर हमें इस तंगी से उबारकर कोई सच्चा सहारा मिला, तो मैं अपनी पहली कमाई से भूखे लोगों में अन्नदान करूंगा और असहाय वृद्धों की सेवा करूंगा।\n\n(O Almighty, our household faces deep livelihood distress and crushing debt. If you guide us through this drought and grant us honest sustenance, I vow to feed the hungry from my first earnings and care for destitute elders.)`,
        summary: `कर्ज व तंगी से मुक्ति की मन्नत और पहली कमाई से अन्नदान / Mannat for relief from financial distress and debt with a pledge to feed the hungry`,
        outcome: `ईमानदार आजीविका, कर्ज से मुक्ति और परिवार का भरण-पोषण / Deliverance from debt, honest livelihood, and food on the family table`,
        promise: `पहली कमाई से भूखों को भरपेट भोजन कराना और वृद्धों की सेवा। / Feeding the hungry from first earnings and serving helpless elders in need.`,
        emotion: `आर्थिक संकट से आहत किंतु आशान्वित / Anxious over livelihood yet steadfastly hopeful`
      },
      {
        category: 'Mannat',
        words: `हे ईश्वर, अगर हमारी मेहनत रंग लाई और हमारी यह डूबती आजीविका व काम बच गया, तो मैं हर पूर्णिमा को मंदिर की सीढ़ियों पर दीप प्रज्वलित करूंगा और निर्धन परिवारों में सूखा राशन वितरित करूंगा।\n\n(O Lord, if our honest trade and livelihood survive this ruinous hardship, I promise to light oil lamps on the sacred steps every full moon and distribute food rations to impoverished families.)`,
        summary: `आजीविका रक्षा की मन्नत और पूर्णिमा को दीपदान व राशन वितरण / Mannat to protect family livelihood with a vow of lighting lamps and distributing rations`,
        outcome: `काम-धंधे की रक्षा, आर्थिक स्थिरता और परिवार की सुरक्षा / Preservation of livelihood, financial stability, and family protection`,
        promise: `हर पूर्णिमा को दीप प्रज्वलन और निर्धनों में सूखा राशन वितरण। / Lighting sacred lamps every full moon and distributing dry rations to poor families.`,
        emotion: `संघर्षरत और विनती करता हुआ / Struggling with trade anxieties and earnestly praying`
      }
    ];
    const picked = financeTemplates[Math.floor(Math.random() * financeTemplates.length)];
    return {
      category: picked.category,
      originalWords: picked.words,
      requestSummary: picked.summary,
      desiredOutcome: picked.outcome,
      explicitPromise: picked.promise,
      emotionalState: picked.emotion,
      source: 'autonomous-situational'
    };
  }

  // 3. Grief / Mourning Loss of a Loved One
  if (contextType === 'illness_or_grief' || emotion === 'grief') {
    return {
      category: 'Mannat',
      originalWords: `हे दयालु ईश्वर, मेरे दिवंगत प्रियजन की आत्मा को अपने श्रीचरणों में शांति प्रदान करना। उनकी पावन स्मृति में, मैं नगर के मार्ग पर एक छायादार वटवृक्ष लगाऊंगा और राहगीरों के लिए शीतल जल की प्याऊ लगवाऊंगा।\n\n(O God of mercy, grant eternal peace and refuge to my departed loved one. In their sacred memory, I vow to plant a leafy banyan shade tree along the public road and establish a drinking water station for weary travelers.)`,
      requestSummary: `दिवंगत परिजन की आत्मिक शांति की मन्नत व छायादार वृक्षारोपण / Mannat in memory of a departed companion with vows of tree-planting and public water service`,
      desiredOutcome: `दिवंगत आत्मा की सद्गति और शोक संतप्त हृदय को संबल / Peaceful afterlife for the departed soul and solace for the grieving heart`,
      explicitPromise: `स्मृति में छायादार वृक्ष लगाना और राहगीरों के लिए शीतल जल की सेवा। / Planting a memorial shade tree and establishing a free drinking water facility for travelers.`,
      emotionalState: `शोकग्रस्त किंतु समर्पित / Deeply grieving yet devoted`,
      source: 'autonomous-situational'
    };
  }

  // 4. High Stress / Mental Agony / Fear & Despair
  if (stress > 65 || contextType === 'personal_struggle') {
    const stressTemplates = [
      {
        category: 'Mannat',
        words: `हे परमेश्वर, मेरे मन में उठ रहे इस घोर भय, अवसाद और भारी अशांति को शांत कीजिए। अगर मुझे मानसिक शांति और नया सवेरा मिला, तो मैं सात दिनों तक मौन व्रत धारण करूंगा और प्रतिदिन सुबह मूक पक्षियों व गौवंश को दाना-चारा दूंगा।\n\n(O Divine Creator, please calm this storm of terrifying anxiety and despair within my heart. If inner peace and mental clarity are restored to me, I vow to observe seven days of sacred silence and feed birds and stray animals every morning.)`,
        summary: `मानसिक शांति व भयमुक्ति की मन्नत और मौन व्रत का संकल्प / Mannat for inner peace and freedom from anxiety with vows of sacred silence and feeding animals`,
        outcome: `मानसिक शांति, तनाव व भय से मुक्ति और आत्मिक संबल / Inner tranquility, freedom from dread, and emotional resilience`,
        promise: `सात दिनों का मौन व्रत और प्रतिदिन पक्षियों व पशुओं को दाना-चारा देना। / Observing seven days of sacred silence and daily feeding of birds and stray animals.`,
        emotion: `मानसिक अशांति और ईश्वर पर विश्वास / Tormented by inner anxiety yet anchoring in faith`
      },
      {
        category: 'Personal Prayer',
        words: `हे प्रभु, मेरी अंतरात्मा को इस बोझ और भ्रम से मुक्त कीजिए। मुझे कठिन समय में सत्य और धैर्य की राह पर चलने का आत्मबल दीजिए।\n\n(O Lord, unburden my soul from this heavy weight and confusion. Grant me the fortitude to walk with truth and patience through life's trials.)`,
        summary: `आत्मिक शांति, धैर्य और नैतिक शक्ति के लिए व्यक्तिगत प्रार्थना / A heartfelt personal prayer seeking patience, clarity, and mental strength`,
        outcome: `आत्मिक शांति और धैर्य की प्राप्ति / Spiritual fortitude, patience, and unburdened heart`,
        promise: null,
        emotion: `शांत और प्रार्थनापूर्ण / Weary and prayerful`
      }
    ];
    const picked = stressTemplates[Math.floor(Math.random() * stressTemplates.length)];
    return {
      category: picked.category,
      originalWords: picked.words,
      requestSummary: picked.summary,
      desiredOutcome: picked.outcome,
      explicitPromise: picked.promise,
      emotionalState: picked.emotion,
      source: 'autonomous-situational'
    };
  }

  // 5. Children / Family Welfare / Offspring
  if (contextType === 'family_welfare' || (agent.family_background && agent.family_background.toLowerCase().includes('child'))) {
    return {
      category: 'Mannat',
      originalWords: `हे भगवान, मेरी संतान को सद्बुद्धि देना और हर कुसंगति व संकट से उसकी रक्षा करना। अगर मेरा बच्चा सही मार्ग पर आगे बढ़ा और उसका जीवन संवर गया, तो मैं निर्धन बालकों को पुस्तकें व वस्त्र दान करूंगा और तीर्थ धाम पर ध्वज चढ़ाऊंगा।\n\n(O Almighty, protect my child from all harm, evil influences, and misguidance. If my child stays on the righteous path and flourishes with wisdom, I pledge to donate clothes and books to needy students and hoist a ceremonial flag at the shrine.)`,
      requestSummary: `संतान के उज्ज्वल भविष्य व सुरक्षा की मन्नत / Mannat for a child's protection, wisdom, and flourishing future`,
      desiredOutcome: `संतान की सुरक्षा, सद्बुद्धि और उज्ज्वल भविष्य / Moral guidance, protection, and blessed future for the child`,
      explicitPromise: `निर्धन बालकों को पुस्तकें व वस्त्र दान और पवित्र धाम पर ध्वज अर्पण। / Donating books and clothing to needy children and hoisting a flag at the holy shrine.`,
      emotionalState: `माता-पिता का वात्सल्य और समर्पण / Deep parental devotion and prayerful love`,
      source: 'autonomous-situational'
    };
  }

  // 6. Loneliness / Companion / Household Union
  if (social < 40) {
    return {
      category: 'Mannat',
      originalWords: `हे भगवान, अगर मेरे इस सूने जीवन में एक नेक और सच्चा जीवनसाथी आया और हमारा घर प्रेम व सद्भाव से भर गया, तो हम दोनों साथ मिलकर आपके पावन धाम पर माथा टेकेंगे और कन्याओं को आदरपूर्वक भोजन कराएंगे।\n\n(O Lord, if you bless my lonely life with a loving and virtuous life partner to share the burdens of existence, we vow to visit your holy altar together and host a sacred feast for young girls.)`,
      requestSummary: `सच्चे जीवनसाथी व गृहस्थ सुख की मन्नत और कन्या भोज / Mannat for a faithful life partner and peaceful home with a vow of hosting a feast for young girls`,
      desiredOutcome: `एक नेक जीवनसाथी, अकेलापन दूर होना और पारिवारिक सुख / A righteous companion, end of loneliness, and domestic happiness`,
      explicitPromise: `धाम पर युगल माथा टेकना और कन्याओं को सत्कारपूर्वक भोजन कराना। / Joint pilgrimage to the holy shrine and hosting a respectful feast for young girls.`,
      emotionalState: `अकेलापन और मिलन की आशा / Lonely and yearning for companionship`,
      source: 'autonomous-situational'
    };
  }

  // 7. General Sanctuary Contemplation / Town Peace / Solemn Mannat
  const generalTemplates = [
    {
      category: 'Mannat',
      words: `हे सर्वशक्तिमान, हमारे इस समाज और नगर को हर आपदा, महामारी और वैमनस्य से सुरक्षित रखना। यदि हमारे समाज में शांति व भाईचारा बना रहा, तो मैं प्रति माह धार्मिक स्थल पर श्रमदान करूंगा और दीपदान करूंगा।\n\n(O Supreme Protector, shield our town and community from disaster, hardship, and strife. If peace and harmony flourish among our people, I vow to perform voluntary physical service at the sanctuary and light oil lamps every month.)`,
      summary: `नगर कल्याण व आपदा मुक्ति की मन्नत और मासिक श्रमदान / Mannat for community peace and protection with vows of monthly sanctuary service`,
      outcome: `नगर में शांति, आपदा से सुरक्षा और नागरिकों में भाईचारा / Peace across the town, protection from calamity, and mutual goodwill`,
      promise: `मासिक स्वच्छता श्रमदान और मंदिर में दीप प्रज्वलन। / Monthly voluntary service at the sanctuary and lighting sacred lamps.`,
      emotion: `श्रद्धा और लोककल्याण की भावना / Pious and dedicated to public welfare`
    },
    {
      category: 'Gratitude',
      words: `हे ईश्वर, आपका कोटि-कोटि धन्यवाद कि आपने हमारे परिवार को इस कठिन दौर से सकुशल निकाला और हमारे जीवन में सुख-शांति लौटाई।\n\n(I offer heartfelt gratitude to the Divine for gently guiding our family through hardship and restoring peace to our lives.)`,
      summary: `संकट निवारण और सुख-शांति के लिए ईश्वर का धन्यवाद / Sincere spiritual thanksgiving for surviving difficult times and restored family peace`,
      outcome: `ईश्वर के प्रति कृतज्ञता और शांति का प्रसार / Continued gratitude, spiritual calm, and harmony`,
      promise: null,
      emotion: `कृतज्ञ और शांत / Grateful and serene`
    },
    {
      category: 'Reflection',
      words: `हे अंतर्यामी, मुझे सत्य, करुणा और निस्वार्थ सेवा के मार्ग पर स्थिर रखना। जीवन के प्रलोभनों में भी मेरा मन धर्म से कभी न डिगे।\n\n(O Knower of hearts, keep me steadfast on the path of truth, compassion, and selfless service. Let not my soul falter when tempted by worldly ease.)`,
      summary: `सत्य, करुणा और आत्मिक शुद्धि के लिए चिंतन / Spiritual reflection seeking moral courage, compassion, and purity of intent`,
      outcome: `नैतिक शक्ति, सत्यनिष्ठा और आत्म-संयम / Moral strength, unshakeable integrity, and compassionate character`,
      promise: null,
      emotion: `विनम्र और आत्म-चिंतनशील / Humble and deeply reflective`
    }
  ];

  const picked = generalTemplates[Math.floor(Math.random() * generalTemplates.length)];
  return {
    category: picked.category,
    originalWords: picked.words,
    requestSummary: picked.summary,
    desiredOutcome: picked.outcome,
    explicitPromise: picked.promise,
    emotionalState: picked.emotion,
    source: 'autonomous-situational'
  };
}

module.exports = {
  generateAgentDecision,
  generateAgentConversation,
  generateNewbornChild,
  generateAgentPrayerOrMannat
};
