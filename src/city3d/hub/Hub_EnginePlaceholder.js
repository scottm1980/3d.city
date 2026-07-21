import { Hub_Pannel } from './Hub_Pannel.js';

//------------------------------------------------------//
//     HONEST PLACEHOLDER FOR UN-MODELED MECHANICS       //
//------------------------------------------------------//
// The original Hub_Eval/Hub_Ordinances/Hub_Awards/Hub_History/
// Hub_Disaster panels are entirely Micropolis-shaped (crime, pollution,
// happiness, ordinances, achievements, disasters) - src/engine models
// none of it, by design (see RENDERER_INTEGRATION_FINDINGS.md's cutover-
// research section: this is deliberately a different game, not a gap).
// Rather than fabricate numbers for mechanics that don't exist, or
// silently drop the panel button a player would expect from the real
// game's UI, this shows an honest "not modeled yet" message - a real,
// working panel, just one that tells the truth about what it is.
export class Hub_EnginePlaceholder extends Hub_Pannel {

	constructor ( hub, title, message, isRight = false ) {

		super( hub, title, isRight );
		this.message = message;

	}

	init () {

		const body = document.createElement( 'div' );
		body.style.cssText = 'padding:14px 12px; pointer-events:none; color:var(--c-text-dim); font-size:12px; line-height:1.6;';
		body.textContent = this.message;
		this.pannel.appendChild( body );

	}

}
