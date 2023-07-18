/* eslint-disable quotes */
/* eslint-disable no-tabs */
/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable indent */
/* eslint-disable eqeqeq */
/* eslint-disable keyword-spacing */
/* eslint-disable space-before-blocks */
import { TypingText } from '../objects/typingtext'
import { Enum } from '../utils/enum'
import BasicExample from '../objects/examples'
import merge_data from '../utils/merge'
import { clamp } from '../utils/clamp'
import signedAngleDeg from '../utils/angulardist'
import { mad, median } from '../utils/medians'
import generateTrials from '../utils/trialgen'
import point_in_circle from '../utils/pointincircle'

const WHITE = 0xffffff
const GREEN = 0x09ce0e // actually move to the target
const MAGENTA = 0xf666bd
const RED = 0xff0000
const GRAY = 0x666666
const DARKGRAY = 0x444444
const LIGHTBLUE = 0xa6d9ea
let TARGET_SIZE_RADIUS = 9 // no longer a constant
const CURSOR_SIZE_RADIUS = 3
const CENTER_SIZE_RADIUS = 12
const MOVE_THRESHOLD = 4
const TARGET_DISTANCE = 320 // *hopefully* they have 300px available?
const CURSOR_RESTORE_POINT = 30 //
const MOVE_SCALE = 1 // factor to combat pointer acceleration
const PI = Math.PI

// fill txts later-- we need to plug in instructions based on their runtime mouse choice
let instruct_txts = {}

const states = Enum([
  'INSTRUCT', // show text instructions (based on stage of task)
  'PRETRIAL', // wait until in center
  'MOVING', // shoot through / mask + animation (if probe)
  'POSTTRIAL', // auto teleport back to restore point
  'END' //
])

const Err = {
  reached_away: 1,
  late_start: 2,
  slow_reach: 4,
  wiggly_reach: 8,
  returned_to_center: 16,
  early_start: 32
}

function randint(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randchoice(arr) {
  return arr[Math.floor(arr.length * Math.random())]
}

function countTrials(array) {
  return array.filter((v) => !v['trial_type'].startsWith('instruct_')).length
}

export default class MainScene extends Phaser.Scene {
  constructor() {
	super({ key: 'MainScene' })
	this._state = states.INSTRUCT
	this.entering = true
	// these line up with trial_type
	this.all_data = {
	  practice_basic: [], // practice reaching with vis feedback
	  clamp: [],
	  washout:[]
	}
  }

  create() {
	let config = this.game.config
	let user_config = this.game.user_config
	// let hand = user_config.hand // 'right' or 'left'
	// camera (origin is center)
	this.cameras.main.setBounds(-config.width / 2, -config.height / 2, config.width, config.height)
	let height = config.height
	let hd2 = height / 2
	this.trial_counter = 0
	this.entering = true
	this.state = states.INSTRUCT
	// used for imagery component
	this.rts = []
	this.movets = []
	this.is_debug = user_config.debug

	// set number of repeats
	if (this.is_debug) {
	  this.trials = generateTrials(4, user_config.clamp_size, true)
	  this.typing_speed = 1
	} else {
	  this.trials = generateTrials(13, user_config.clamp_size, false)
	  this.typing_speed = 1
	}

	// target
	let radians = Phaser.Math.DegToRad(270)
	let x = TARGET_DISTANCE * Math.cos(radians)
	let y = TARGET_DISTANCE * Math.sin(radians)
	this.target = this.add.circle(x, y, TARGET_SIZE_RADIUS, GRAY) // will be changed!
	this.target.visible = false

	// user cursor
	this.user_cursor = this.add.circle(CURSOR_RESTORE_POINT, -CURSOR_RESTORE_POINT, CURSOR_SIZE_RADIUS, WHITE) // controlled by user (gray to reduce contrast)
	this.fake_cursor = this.add.circle(0, 0, CURSOR_SIZE_RADIUS, WHITE).setVisible(false) // animated by program

	// center
	this.center = this.add.circle(0, 0, CENTER_SIZE_RADIUS, 0xEEEEEE)
	this.origin = new Phaser.Geom.Circle(0, 0, CENTER_SIZE_RADIUS)

	this.endpoint_cursor = this.add.circle(0, 0, CURSOR_SIZE_RADIUS, WHITE)
	this.endpoint_cursor.visible = false

	// might have attn checks for understanding of colors indicating prep time, add in questions?

	// big fullscreen quad in front of game, but behind text instructions
	this.darkener = this.add.rectangle(0, 0, height, height, 0x000000).setAlpha(1)


	// warning text for bad trials
	this.other_warns = this.add.
	  rexBBCodeText(0, 0, '', {
		fontFamily: 'Verdana',
		fontStyle: 'bold',
		fontSize: 50,
		color: '#ffffff',
		align: 'center',
		stroke: '#444444',
		backgroundColor: '#000000',
		strokeThickness: 4
	  }).
	  setOrigin(0.5, 0.5).
	  setVisible(false)

	this.instructions = TypingText(this, /* half width */-400, -hd2 + 50, '', {
	  fontFamily: 'Verdana',
	  fontSize: 20,
	  wrap: {
		mode: 'word',
		width: 800
	  }
	}).setVisible(false)

	this.start_txt = this.add.
	  text(0, hd2 - 100, 'Click the mouse button to continue.', {
		fontFamily: 'Verdana',
		fontSize: 50,
		align: 'center'
	  }).
	  setOrigin(0.5, 0.5).
		  setVisible(false)
	this.check_txt = this.add.text(0, hd2 - 100, 'Press (a) or (b) to select your answer.', {
		  fontFamily: 'Verdana',
		  fontSize: 50,
		  align: 'center'
	  }).setOrigin(0.5, 0.5).setVisible(false)

	this.progress = this.add.text(hd2, -hd2, '').setOrigin(1, 0)
	this.tmp_counter = 1
	this.total_len = countTrials(this.trials)
	// examples
	this.examples = { // come back to this; need to set up prep times in exmples
	  // go + feedback
	  basic: new BasicExample(this, 0, 200, true, false).setVisible(false),
	  clamp: new BasicExample(this, 0, 200, true, true).setVisible(false)
	}


	// start the mouse at offset
	this.raw_x = CURSOR_RESTORE_POINT
	this.raw_y = -CURSOR_RESTORE_POINT
	this.next_trial()


	// set up mouse callback (does all the heavy lifting)
	this.input.on('pointerdown', () => {
	  if (this.state !== states.END) {
		!DEBUG && this.scale.startFullscreen()
		this.time.delayedCall(300, () => {
		  this.input.mouse.requestPointerLock()
		})
	  }
	})
	this.input.on('pointerlockchange', () => {
	  console.log('oh no, this does not work')
	})

	this.ptr_cb = (ptr) => {
	  if (this.input.mouse.locked) {
		let is_coalesced = 'getCoalescedEvents' in ptr
		// feature detect firefox (& ignore, see https://bugzilla.mozilla.org/show_bug.cgi?id=1753724)
		// TODO: detect first input & use as reference position for FF
		let not_ff = 'altitudeAngle' in ptr
		// AFAIK, Safari and IE don't support coalesced events
		// See https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
		let evts = is_coalesced && not_ff ? ptr.getCoalescedEvents() : [ptr]
		// console.log(evts.length)
		// the timestamps of ptr and the last event should match, and the
		// sum of all movements in evts should match ptr
		// console.log(ptr)
		// console.log(evts[evts.length - 1])
		for (let evt of evts) {
		  // scale movement by const factor
		  let dx = evt.movementX * MOVE_SCALE
		  let dy = evt.movementY * MOVE_SCALE
		  // console.log(`t: ${evt.timeStamp}, dxdy: (${dx}, ${dy})`)
		  // update "raw" mouse position (remember to set these back to (0, 0)
		  // when starting a new trial)
		  this.raw_x += dx
		  this.raw_y += dy
		  this.raw_x = clamp(this.raw_x, -hd2, hd2)
		  this.raw_y = clamp(this.raw_y, -hd2, hd2)

		  // useful for deciding when to turn on/off visual feedback
		  let extent = Math.sqrt(Math.pow(this.raw_x, 2) + Math.pow(this.raw_y, 2))
		  // convert cursor angle to degrees
		  let cursor_angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Normalize(Math.atan2(this.raw_y, this.raw_x)))
		  let curs_x = this.raw_x
		  let curs_y = this.raw_y

		  this.cursor_angle = cursor_angle
		  this.user_cursor.x = curs_x
		  this.user_cursor.y = curs_y
		  this.extent = extent

		  // set up the clamp cursor
		  let rad = Phaser.Math.DegToRad(this.current_trial.clamp_angle + this.current_trial.target_angle)
		  this.fake_cursor.x = extent * Math.cos(rad)
		  this.fake_cursor.y = extent * Math.sin(rad)

		  if (this.state === states.MOVING) {
			this.movement_data.push({
			  evt_time: evt.timeStamp,
			  raw_x: this.raw_x,
			  raw_y: this.raw_y,
			  cursor_x: curs_x,
			  cursor_y: curs_y,
			  cursor_extent: extent,
			  cursor_angle: cursor_angle
			})
		  }
		  if (this.state === states.POSTTRIAL) {
			if (this.current_trial.is_clamped) {
			  this.endpoint_cursor.x = TARGET_DISTANCE * Math.cos(rad)
			  this.endpoint_cursor.y = TARGET_DISTANCE * Math.sin(rad)
			} else {
			  this.endpoint_cursor.x = TARGET_DISTANCE * Math.cos(Phaser.Math.DegToRad(this.endpoint_angle))
			  this.endpoint_cursor.y = TARGET_DISTANCE * Math.sin(Phaser.Math.DegToRad(this.endpoint_angle))
			}
		  }
		}
	  }
	}

	document.addEventListener('pointermove', this.ptr_cb, {passive: true, capture: true})
	// initial instructions (move straight through target)
	instruct_txts['instruct_basic'] =
		`This is an instruction page! You can add line breaks! \n
		You can also add colored text. [color=#f666bd] This color is #F666BD[/color]. [b]You can also bold text![/b]\n
		This task is a reaching task. Find the center then, when the target appears, slice through the target.`
	instruct_txts['instruct_clamp'] =
		`This is a clamp. The cursor will follow a straight line path which is predetermined. You can't control the cursor and the cursor doesn't tell you where your hand is.\n
		  Ignore the cursor and keep trying to go straight to the taget.`
	  instruct_txts['instruct_check'] =
		  `This is an attention check. Select the correct option below. \n
		  (a) I like this tutorial!\n\n
		  (b) ChatGPT is better. Boo!`
  } // end create

  update() {
	let current_trial = this.current_trial
	switch (this.state) {
	case states.INSTRUCT:
	  if (this.entering) {
		this.entering = false
		let tt = current_trial.trial_type

		// show the right instruction text, wait until typing complete
		// and response made
		this.instructions.visible = true
		this.darkener.visible = true
		this.instructions.start(instruct_txts[tt], this.typing_speed)
		this.instructions.typing.once('complete', () => {
			if (this.current_trial.trial_type === 'instruct_check') {
				this.check_txt.visible = true
				this.input.keyboard.once('keydown-B', () => {
					this.next_trial()
					this.darkener.visible = false
					this.instructions.visible = false
					this.instructions.text = ''
					this.check_txt.visible = false
					this.game.user_config.attn_check = "Wrong!"
				})
				this.input.keyboard.once('keydown-A', () => {
					this.next_trial()
					this.darkener.visible = false
					this.instructions.visible = false
					this.instructions.text = ''
					this.check_txt.visible = false
					this.game.user_config.attn_check = "Correct!"
				})
			} else {
				this.start_txt.visible = true
				this.input.once('pointerdown', () => {
					this.next_trial()
					this.darkener.visible = false
					this.instructions.visible = false
					this.instructions.text = ''
					this.start_txt.visible = false
				})
			}
		})
	  }
	  break
	case states.PRETRIAL:
	  if (this.entering) {
		this.origin.visible = true
		this.center.visible = true
		this.entering = false
		this.target.visible = false
		this.hold_val = 500
		this.hold_t = this.hold_val
		this.user_cursor.visible = true
		this.t_ref = window.performance.now()
	  }
	  if (Phaser.Geom.Circle.ContainsPoint(this.origin, this.user_cursor)) {
		this.hold_t -= this.game.loop.delta
		if (this.hold_t <= 0) {
		  this.inter_trial_interval = window.performance.now() - this.t_ref
		  this.raw_x = 0
		  this.raw_y = 0
		  this.extent = 0
		  this.user_cursor.x = 0
		  this.user_cursor.y = 0
		  this.state = states.MOVING
		  this.movement_data = []
		}
	  } else {
		this.hold_t = this.hold_val
	  }
	  break
	case states.MOVING:
	  if (this.entering) {
		this.entering = false
		this.reference_time = this.game.loop.now
		this.last_frame_time = this.game.loop.now
		this.dropped_frame_count = 0
		this.dts = []
		// every trial starts at 0, 0
		this.movement_data.splice(0, 0, {
		  evt_time: this.reference_time,
		  raw_x: 0,
		  raw_y: 0,
		  cursor_x: 0,
		  cursor_y: 0,
		  cursor_extent: 0,
		  cursor_angle: 0
		})
		// hide center
		this.center.visible = false
		// show target
		var rad = Phaser.Math.DegToRad(this.current_trial.target_angle)
		this.target.x = TARGET_DISTANCE * Math.cos(rad)
		this.target.y = TARGET_DISTANCE * Math.sin(rad)
		this.target.fillColor = GREEN
		this.target.visible = true


		this.user_cursor.visible = current_trial.is_cursor_vis
		// let delay_frames = Math.round(this.game.user_config.refresh_rate_est * (0.001 * current_trial.delay))
		let delay_frames = 0

		if (current_trial.is_clamped) {
		  this.user_cursor.visible = false
		  this.fake_cursor.visible = current_trial.is_cursor_vis
		}
	  } else { // second iter ++
		let est_dt = 1 / this.game.user_config.refresh_rate_est * 1000
		let this_dt = this.game.loop.now - this.last_frame_time
		this.dropped_frame_count += this_dt > 1.5 * est_dt
		this.dts.push(this_dt)
		this.last_frame_time = this.game.loop.now
	  }
	  let real_extent = Math.sqrt(Math.pow(this.user_cursor.x, 2) + Math.pow(this.user_cursor.y, 2))

	  if (real_extent >= 0.98 * TARGET_DISTANCE) {
		this.state = states.POSTTRIAL
		this.user_cursor.visible = false // compute endpoint feedback
		this.fake_cursor.visible = false
		this.endpoint_angle = this.cursor_angle
	  }
	  break

	case states.POSTTRIAL:
	  if (this.entering) {
		this.entering = false
		// deal with trial data
		let trial_data = {
		  movement_data: this.movement_data,
		  ref_time: this.reference_time,
		  trial_number: this.trial_counter++,
		  target_size_radius: TARGET_SIZE_RADIUS, // varies
		  cursor_size_radius: CURSOR_SIZE_RADIUS,
		  iti: this.inter_trial_interval, // amount of time between cursor appear & teleport
		  hold_time: this.hold_val,
		  dropped_frame_count: this.dropped_frame_count
		}
		let combo_data = merge_data(current_trial, trial_data)
		console.log('Combo Data: ' + combo_data)
		let delay = 200
		let fbdelay = 0
		// feedback about movement angle (if non-imagery)
		let first_element = trial_data.movement_data[1]
		let last_element = trial_data.movement_data[trial_data.movement_data.length - 1]
		let target_angle = current_trial.target_angle

		let reach_angles = this.movement_data.filter((a) => a.cursor_extent > 15).map((a) => a.cursor_angle)
		let end_angle = reach_angles.slice(-1)
		let norm_reach_angles = reach_angles.map((a) => signedAngleDeg(a, end_angle))
		let reaction_time = null
		let reach_time = null
		if (last_element && trial_data.movement_data.length > 2) {
		  var start_left_idx = trial_data.movement_data.findIndex(function(e) {
			return e.cursor_extent >= 15
		  })
		  reaction_time = trial_data.movement_data[start_left_idx].evt_time - this.reference_time
		  reach_time = last_element.evt_time - trial_data.movement_data[start_left_idx].evt_time
		}
		console.log(reaction_time)
		if (!(reaction_time === null)) {
		  this.rts.push(reaction_time)
		  this.movets.push(reach_time)
		}
		let punished = false
		let punish_delay = 1000
		let punish_flags = 0
		if (this.current_trial.trial_type !== 'tutorial' && Math.abs(signedAngleDeg(last_element.cursor_angle, target_angle)) >= 30) {
		  punish_flags |= Err.reached_away
		  if (!punished) {
			punished = true
			this.other_warns.text = '[b]Make reaches toward\nthe target.[/b]'
		  }
		}
		if (reaction_time >= 1000) {
		  punish_flags |= Err.late_start
		  if (!punished) {
			punished = true
			this.other_warns.text = '[b]Please start the\nreach sooner.[/b]'
		  }
		}

		if (reach_time >= 200) {
		  // slow reach
		  punish_flags |= Err.slow_reach
		  if (!punished) {
			punished = true
			this.other_warns.text = '[b]Please move quickly\n through the target.[/b]'
			this.too_slow.play()
		  }
		}
		  if (this.current_trial.trial_type !== 'tutorial' && mad(norm_reach_angles) > 10) {
		  // wiggly reach
		  punish_flags |= Err.wiggly_reach
		  if (!punished) {
			punished = true
			this.other_warns.text = '[b]Please make [color=yellow]straight[/color]\nreaches toward the target.[/b]'
		  }
		}
		if (punished) {
		  delay += punish_delay
		  this.other_warns.visible = true

		  this.target.visible = false
		  this.center.fillColor = GRAY
		  this.time.delayedCall(punish_delay, () => {
			this.other_warns.visible = false
		  })
		} else {
		  // display the endpoint cursor
		  this.endpoint_cursor.visible = this.current_trial.show_feedback
		}
		combo_data['delay_time'] = delay
		combo_data['reaction_time'] = reaction_time
		combo_data['reach_time'] = reach_time
		combo_data['hit'] = point_in_circle(last_element.raw_x, last_element.raw_y, this.target.x, this.target.y, TARGET_SIZE_RADIUS)
		this.time.delayedCall(fbdelay, () => {
		  this.time.delayedCall(delay, () => {
			combo_data['any_punishment'] = punished
			combo_data['punish_types'] = punish_flags
			if (current_trial.trial_type !== 'tutorial') {
				this.all_data[current_trial.trial_type].push(combo_data)
			}
			this.tmp_counter++
			this.raw_y = this.user_cursor.y = -CURSOR_RESTORE_POINT
			this.raw_x = this.user_cursor.x = CURSOR_RESTORE_POINT
			this.user_cursor.visible = true
			this.target.visible = false
			this.jumptarget.visible = false
			this.endpoint_cursor.visible = false
			this.tweens.add({
			  targets: this.user_cursor,
			  scale: { from: 0, to: 1 },
			  ease: 'Elastic',
			  easeParams: [5, 0.5],
			  duration: 800,
			  onComplete: () => {
				this.center.fillColor = GRAY
				this.next_trial()
			  }
			})
		  })
		})
	  }
	  break
	case states.END:
	  if (this.entering) {
		this.entering = false
		this.input.mouse.releasePointerLock()
		document.removeEventListener('pointermove', this.ptr_cb, {passive: true, capture: true})
		// fade out
		this.tweens.addCounter({
		  from: 255,
		  to: 0,
		  duration: 2000,
		  onUpdate: (t) => {
			let v = Math.floor(t.getValue())
			this.cameras.main.setAlpha(v / 255)
		  },
		  onComplete: () => {
			// this.scene.start('QuestionScene', { question_number: 1, data: this.all_data })
			this.scene.start('EndScene', this.all_data)
		  }
		})
	  }
	  break
	}
  } // end update

  get state() {
	return this._state
  }

  set state(newState) {
	this.entering = true
	this._state = newState
  }

  next_trial() {
	// move to the next trial, and set the state depending on trial_type
	if (this.tmp_counter > this.total_len) {
	  this.progress.visible = false
	} else {
	  this.progress.text = `${this.tmp_counter} / ${this.total_len}`
	}
	this.current_trial = this.trials.shift()
	let cur_trial = this.current_trial
	let tt = ''
	if (cur_trial !== undefined) {
	  tt = cur_trial.trial_type
	}
	if (cur_trial === undefined || this.trials.length < 1 && tt.startsWith('break')) {
	  this.state = states.END
	} else if (tt.startsWith('instruct_') || tt.startsWith('break')) {
	  this.state = states.INSTRUCT
	} else if (
	  tt.startsWith('practice') ||
	  tt.startsWith('clamp') ||
	  tt.startsWith('washout')
	) {
	  this.state = states.PRETRIAL
	  this.center.fillColor = WHITE
	  this.target.visible = false
	} else {
	  // undefine
	  console.error('Oh no, wrong next_trial.')
	}
  }
}
