/**
 * Scoring rules:
 *
 * When hasAI = true:
 *   +3  voted for the AI player (correct)
 *   +2  was robot-human and NOT most voted (fooled people without being caught)
 *   +3  was mole and AI won (successfully protected Claude)
 *
 * When hasAI = false (paranoia round — no AI present):
 *   +2  voted for a real human (resisted paranoia)
 *   -1  voted for the robot-human (got fooled into thinking they were AI)
 *   +3  was robot-human and WAS most voted (successfully fooled everyone)
 */
function calculateRoundScores(room, mostVoted) {
  const delta = {}; // { playerName: pointsEarnedThisRound }
  const realPlayers = room.players.filter((p) => !p.isAI);

  realPlayers.forEach((player) => {
    const { name } = player;
    const role = room.roles[name];
    const votedFor = room.votes[name];
    let points = 0;

    if (room.hasAI) {
      if (votedFor === room.aiPlayerName) points += 3;
      if (role === 'robot-human' && mostVoted !== name) points += 2;
      if (role === 'mole' && mostVoted !== room.aiPlayerName) points += 3;
    } else {
      if (role === 'robot-human') {
        if (mostVoted === name) points += 3;
      } else {
        if (votedFor === room.aiPlayerName) {
          // voted for the "ai slot" which doesn't exist — shouldn't happen, but guard it
          points += 0;
        } else if (votedFor !== null) {
          const votedRole = room.roles[votedFor];
          points += votedRole === 'robot-human' ? -1 : 2;
        }
      }
    }

    delta[name] = points;
  });

  return delta;
}

function applyScores(room, delta) {
  Object.entries(delta).forEach(([name, points]) => {
    if (room.scores[name] === undefined) room.scores[name] = 0;
    room.scores[name] += points;
  });
}

function getSortedLeaderboard(scores) {
  return Object.entries(scores)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { calculateRoundScores, applyScores, getSortedLeaderboard };
