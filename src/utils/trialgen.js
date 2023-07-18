/* eslint-disable indent */
/* eslint-disable space-infix-ops */
/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable no-tabs */
/*
NB target distance is a constant in main
center sizes are consts in main


*/

/*
repeats (default 25) is number of repeats per clamp type
*/
function cryptoRand() {
  const array = new Uint32Array(1)
  self.crypto.getRandomValues(array)
  return array / 4294967296
}

function shuffle(array) {
  let currentIndex = array.length; let randomIndex

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(cryptoRand() * currentIndex)
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
	  array[randomIndex], array[currentIndex]]
  }

  return array
}


export default function generateTrials(repeats = 25, CLAMP_ANGLE = 7, is_debug = false) {
  let reps = is_debug ? 10 : 20
  let targ_loc = 270
  let out = []
  out.push({ trial_type: 'instruct_basic' }) // first page
  for (let i = 0; i < reps; i++) {
    out.push({
	  trial_type: 'practice_basic',
	  is_clamped: false,
	  clamp_angle: 0,
	  is_cursor_vis: true,
	  show_feedback: true,
	  target_angle: targ_loc,
	  jump_angle: 0,
	  jump_onset: 0.5,
	  rwd: 5 // veridical
    })
  }

  out.push({ trial_type: 'instruct_nofb' })
  var rwds = [1, 2, 3, 4]
  var rwd_order = shuffle(rwds)
  rwd_order = rwd_order.concat(shuffle(rwds))
  rwd_order = rwd_order.concat(shuffle(rwds))
  rwd_order = rwd_order.concat(shuffle(rwds))
  rwd_order = rwd_order.concat(shuffle(rwds))
  for (let i = 0; i < reps; i++) {
    out.push({
	  trial_type: 'practice_nofb',
	  is_clamped: false,
	  clamp_angle: 0,
	  is_cursor_vis: false,
	  show_feedback: false,
	  target_angle: targ_loc,
	  jump_angle: 0,
	  jump_onset: 0.5,
	  rwd: rwd_order[i] // veridical
    })
  }

  out.push({ trial_type: 'instruct_clamp' }) // clamp instructions
  out.push({ trial_type: 'instruct_tut1' })
  out.push({
	  trial_type: 'tutorial',
	  is_clamped: true,
	  clamp_angle: 45,
	  is_cursor_vis: true,
	  show_feedback: true,
	  target_angle: targ_loc,
	  jump_angle: 0,
	  jump_onset: 0.5,
	  rwd: 0
  })
  out.push({ trial_type: 'instruct_tut2' })
  out.push({
	  trial_type: 'tutorial',
	  is_clamped: true,
	  clamp_angle: 45,
	  is_cursor_vis: true,
	  show_feedback: true,
	  target_angle: targ_loc,
	  jump_angle: 45,
	  jump_onset: 0.5,
	  rwd: 0
  })
  out.push({ trial_type: 'instruct_tut3' })
  out.push({
	  trial_type: 'tutorial',
	  is_clamped: true,
	  clamp_angle: 45,
	  is_cursor_vis: true,
	  show_feedback: true,
	  target_angle: targ_loc,
	  jump_angle: 45,
	  jump_onset: 0.5,
	  rwd: 0
  })
  out.push({ trial_type: 'instruct_clamp2' })
  out.push({ trial_type: 'instruct_check'})
  var sign = -1
  for (let i = 0; i < repeats; i++) {
    var order = []
    let good_order = false

    while (!good_order) {
	  good_order = true
	  order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
	  order = order.sort(() => Math.random() - 0.5)
	  good_order = order[0] % 2 !== sign // impose requirement that each cycle starts with a sign flip
	  let rots = []
	  rots = order.map(function(t) {
        return t % 2 == 0
	  })
	  for (var j = 1; j < rots.length - 3; j++) {
        if (rots[j] == rots[j + 1] && rots[j] == rots[j + 2] && rots[j] == rots[j+3]) {
		  good_order = false // cant have same rot direction 4x in a row; is imperfect bc only applies within a cycle
        }
	  }
	}
	sign = order[order.length-1] % 2
    for (var j = 0; j < order.length; j++) {
	  var rwd_t = order[j] % 8 == 0 ? 8 : order[j] % 8
	  rwd_t = Math.ceil(rwd_t / 2)
	  var jump = order[j] > 8 ? 1 : 0
	  out.push({
		  trial_type: 'clamp',
		  is_clamped: true,
		  clamp_angle: (order[j] % 2 == 0) ? CLAMP_ANGLE : -1*CLAMP_ANGLE,
		  is_cursor_vis: true,
		  show_feedback: true,
		  target_angle: targ_loc,
		  jump_angle: (order[j] % 2 == 0) ? CLAMP_ANGLE * jump : -1 * CLAMP_ANGLE * jump,
		  jump_onset: 0.5,
		  rwd: rwd_t
	  })
    }
  }
  out.push({
	  trial_type: 'clamp',
	  is_clamped: true,
	  clamp_angle: 0,
	  is_cursor_vis: true,
	  show_feedback: true,
	  target_angle: targ_loc,
	  jump_angle: 0,
	  jump_onset: 0.5,
	  rwd: 3
  }) // filler trial
  // comprehension check at the end
  out.push({ trial_type: 'instruct_check2' })
  return out
}
