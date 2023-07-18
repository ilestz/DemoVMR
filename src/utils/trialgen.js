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
	  target_angle: targ_loc
    })
  }


  out.push({ trial_type: 'instruct_clamp' }) // clamp instructions
  out.push({ trial_type: 'instruct_check'})
  var sign = -1
  for (let i = 0; i < repeats; i++) {

    for (var j = 0; j < order.length; j++) {
	  var rwd_t = order[j] % 8 == 0 ? 8 : order[j] % 8
	  rwd_t = Math.ceil(rwd_t / 2)
	  var jump = order[j] > 8 ? 1 : 0
	  out.push({
		  trial_type: 'clamp',
		  is_clamped: true,
		  clamp_angle: CLAMP_ANGLE,
		  is_cursor_vis: true,
		  show_feedback: true,
		  target_angle: targ_loc
	  })
    }
  }
  out.push({
	  trial_type: 'wash',
	  is_clamped: true,
	  clamp_angle: 0,
	  is_cursor_vis: false,
	  show_feedback: false,
	  target_angle: targ_loc
  }) // filler trial
  return out
}
