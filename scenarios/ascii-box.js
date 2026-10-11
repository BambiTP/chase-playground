// Hand-drawn arena. Letters are floor tiles you can spawn on with `mark`.
//   # wall   . floor   ◣◤◥◢ (or 1 2 3 4) 45 degree walls, the wall half is the corner it points to
module.exports = {
  name: 'ascii box',
  map: {
    ascii: `
################
#◤............◥#
#..............#
#..r...........#
#......##......#
#......##....c.#
#..............#
#◣............◢#
################`,
  },
  ticks: 600,
  stopWhen: 'tag',
  balls: [
    // timeline form: from tick N on, hold these keys
    { id: 'runner', team: 2, mark: 'r', keys: [[0, 'down'], [40, 'down right'], [100, 'right'], [200, 'up right']] },
    { id: 'chaser', team: 1, mark: 'c', bot: 'lead', lead: 0.4 },
  ],
};
