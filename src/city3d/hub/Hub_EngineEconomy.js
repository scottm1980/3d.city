import { Hub_Pannel } from './Hub_Pannel.js';

//------------------------------------------------------//
//   ECONOMY PANEL: a real, working src/engine lever     //
//------------------------------------------------------//
// The original Hub_Economy.js panel picks a city's "industry
// specialization" - src/engine has no such concept, but it has something
// that maps cleanly to the same idea: TownCharterTool's per-city
// residential/commercial/industrial growth weights (DefaultTownCharter,
// TownCharterTool.js), which already drive how an AUTOMATED city zones
// itself every tick. This panel doesn't fake anything - the sliders here
// write directly into the same charter object RegionOrchestrator's
// charterFor(city) callback returns, so moving them for real changes
// what that city builds on its next automated-growth tick.
//
// MANAGED cities have no charter to adjust - the player zones them
// directly via the real BUILD panel - so this panel says that plainly
// instead of showing sliders that would do nothing.
export class Hub_EngineEconomy extends Hub_Pannel {

	init () {

		this.body = document.createElement( 'div' );
		this.body.style.cssText = 'padding:10px 12px; pointer-events:auto; color:var(--c-text); font-size:12px; line-height:1.6;';
		this.pannel.appendChild( this.body );

		this._builtForMode = null; // tracks which layout is currently in the DOM, so update() only rebuilds on an actual mode change, never mid-drag
		this._sliders = {};

	}

	_slider ( label, initialValue, onChange ) {

		const wrap = document.createElement( 'div' );
		wrap.style.cssText = 'margin-bottom:10px;';

		const labelRow = document.createElement( 'div' );
		labelRow.style.cssText = 'display:flex; justify-content:space-between; font-size:11px; color:var(--c-text-dim); margin-bottom:3px;';
		const labelEl = document.createElement( 'span' );
		labelEl.textContent = label;
		const valueEl = document.createElement( 'span' );
		valueEl.style.color = 'var(--c-text)';
		valueEl.textContent = initialValue.toFixed( 2 );
		labelRow.appendChild( labelEl );
		labelRow.appendChild( valueEl );
		wrap.appendChild( labelRow );

		const input = document.createElement( 'input' );
		input.type = 'range';
		input.min = '0';
		input.max = '1';
		input.step = '0.01';
		input.value = String( initialValue );
		input.style.cssText = 'width:100%; accent-color:var(--c-accent);';
		input.addEventListener( 'input', () => {

			const v = Number( input.value );
			valueEl.textContent = v.toFixed( 2 );
			onChange( v );

		} );
		wrap.appendChild( input );

		return { wrap, input, valueEl };

	}

	_buildManagedMessage () {

		this.body.innerHTML = '';
		const msg = document.createElement( 'div' );
		msg.style.cssText = 'color:var(--c-text-dim); font-style:italic;';
		msg.textContent = 'This city is MANAGED - you control its zoning directly via the BUILD panel. Charter weights only apply to AUTOMATED cities.';
		this.body.appendChild( msg );
		this._sliders = {};

	}

	_buildAutomatedSliders ( charter ) {

		this.body.innerHTML = '';

		const intro = document.createElement( 'div' );
		intro.style.cssText = 'color:var(--c-text-dim); font-size:11px; margin-bottom:8px;';
		intro.textContent = 'Relative growth weights - real levers, read by TownCharterTool every automated-growth tick. An on-site resource always wins toward industrial regardless of these.';
		this.body.appendChild( intro );

		this._sliders = {
			residential: this._slider( 'Residential', charter.residential, v => { charter.residential = v; } ),
			commercial: this._slider( 'Commercial', charter.commercial, v => { charter.commercial = v; } ),
			industrial: this._slider( 'Industrial', charter.industrial, v => { charter.industrial = v; } ),
		};

		for ( const key of [ 'residential', 'commercial', 'industrial' ] ) this.body.appendChild( this._sliders[ key ].wrap );

	}

	// data: { controlMode: 'MANAGED'|'AUTOMATED', charter: TownCharter | null (mutable, per-city) }
	// Rebuilds the DOM only the first time this is called, or when the
	// control mode actually changes - never on every tick, which would
	// tear down and recreate the <input type="range"> mid-drag and make
	// dragging the slider feel broken. Once built, only values/labels are
	// refreshed, and only from the charter object itself, so a drag
	// already in progress (which already wrote into that same object)
	// isn't fought by the next tick's update().
	update ( data ) {

		if ( ! this.body ) return; // init() hasn't run yet (lazy, on first open())

		const isAutomated = data.controlMode === 'AUTOMATED' && !! data.charter;
		const wantMode = isAutomated ? 'automated' : 'managed';

		if ( this._builtForMode !== wantMode ) {

			if ( isAutomated ) this._buildAutomatedSliders( data.charter );
			else this._buildManagedMessage();
			this._builtForMode = wantMode;
			return;

		}

		if ( ! isAutomated ) return;

		for ( const key of [ 'residential', 'commercial', 'industrial' ] ) {

			const slider = this._sliders[ key ];
			if ( ! slider ) continue;
			// Only resync from the model if the slider isn't the active
			// drag target - avoids the input jumping under the pointer
			// mid-gesture while still staying correct for any external
			// change to the charter object.
			if ( document.activeElement === slider.input ) continue;
			const v = data.charter[ key ];
			slider.input.value = String( v );
			slider.valueEl.textContent = v.toFixed( 2 );

		}

	}

}
