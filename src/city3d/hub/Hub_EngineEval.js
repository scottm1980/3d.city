import { Hub_Pannel } from './Hub_Pannel.js';

// A real composite health score from src/engine's own state - see
// engine/observability/CityEvaluation.js for how score/vitality/solvency/
// strain are actually computed. This panel only renders whatever it's
// given via update(); it holds no engine logic itself, same as the
// original Hub_Eval.js's relationship to AppState.main.
export class Hub_EngineEval extends Hub_Pannel {

	constructor( hub, isRight ) {

		super( hub, 'Eval', isRight );

	}

	init() {

		this.body = document.createElement('div');
        this.body.style.cssText = 'padding:10px 12px; pointer-events:none;';
        this.pannel.appendChild( this.body );

		this.scoreLine = document.createElement('div');
        this.scoreLine.style.cssText = 'font-size:24px; font-weight:700; color:#dce8f5; margin-bottom:8px; text-align:center;';
        this.body.appendChild( this.scoreLine );

        this.bars = {};
        for ( const key of [ 'vitality', 'solvency', 'strain' ] ) {

            this.bars[ key ] = this._makeBar( key );

        }

        this.countsLine = document.createElement('div');
        this.countsLine.style.cssText = 'font-size:11px; color:rgba(180,210,240,0.6); margin-top:8px;';
        this.body.appendChild( this.countsLine );

	}

	_makeBar ( label ) {

		const row = document.createElement('div');
        row.style.cssText = 'margin-bottom:8px;';
        this.body.appendChild( row );

        const labelEl = document.createElement('div');
        labelEl.style.cssText = 'font-size:10px; font-weight:700; letter-spacing:0.08em;'
                              + ' color:rgba(180,210,240,0.6); text-transform:uppercase; margin-bottom:2px;'
                              + ' display:flex; justify-content:space-between;';
        labelEl.innerHTML = '<span>' + label + '</span><span class="value">0</span>';
        row.appendChild( labelEl );

        const track = document.createElement('div');
        track.style.cssText = 'width:100%; height:8px; border-radius:4px; background:rgba(255,255,255,0.07);'
                            + ' border:1px solid rgba(100,160,220,0.22); overflow:hidden;';
        row.appendChild( track );

        const fill = document.createElement('div');
        fill.style.cssText = 'height:100%; width:0%; border-radius:4px; background:#4a9edd; transition:width 200ms;';
        track.appendChild( fill );

        return { fill, valueEl: labelEl.querySelector('.value') };

	}

	update ( data ) {

		// Guard on init() having run (this.body exists), not on open/closed
		// state - refreshing while closed means the panel shows current
		// data immediately on open rather than stale data from whenever it
		// was last open.
		if ( ! this.body ) return;
		if ( ! data ) return;

		this.scoreLine.textContent = 'Score: ' + data.score;

        const colors = { vitality: '#4bcc7a', solvency: '#f0b84a', strain: '#61B2F4' };
        for ( const key of [ 'vitality', 'solvency', 'strain' ] ) {

            const v = data[ key ] || 0;
            const bar = this.bars[ key ];
            bar.fill.style.width = v + '%';
            bar.fill.style.background = v >= 60 ? colors[ key ] : v >= 30 ? '#f0b84a' : '#e05555';
            bar.valueEl.textContent = v;

        }

        this.countsLine.textContent = data.activeCount + ' active / ' + data.stalledCount + ' stalled / ' + data.facilityCount + ' total facilities';

	}

}
