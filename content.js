const GAME_CONTENT = {
  intro: `Welcome to Reverse Mafia.

One of you might be an AI pretending to be human.
Or maybe two of you. Or maybe none.

Chat for the next few minutes. Watch closely. Then vote on who you think is the bot.

Trust no one. Including yourself.`,

  reveals: {
    aiCaught: `🎯 You caught the AI.

Humanity wins this round. Barely.`,

    aiFooled: `🤖 The AI walked among you.

You voted for a human. The bot is still out there, laughing in lowercase.`,

    noAI: `😶 Plot twist: there was no AI this round.

You were just suspicious of each other the whole time.
Humans are weird.`,
  },

  roles: {},

  playerNames: [],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_CONTENT;
}
if (typeof window !== 'undefined') {
  window.GAME_CONTENT = GAME_CONTENT;
}
