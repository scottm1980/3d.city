import { Hub_Pannel } from './Hub_Pannel.js';

// Real time-series over live region state - see
// engine/observability/CityHistory.js. Shows the most recent samples as a
// compact table (newest first) rather than a chart - no charting library
// dependency, and the raw numbers are exactly what CityHistory recorded.
const MAX_ROWS_SHOWN = 12;

export class Hub_EngineHistory extends Hub_Pannel {

	constructor( hub, isRight ) {

		super( hub, 'History', isRight );

	}

	init() {

		this.body = document.createElement('div');
        this.body.style.cssText = 'padding:10px 12px; pointer-events:none; overflow-y:auto; max-height:400px;'
                                 + ' font-size:11px; color:#dce8f5;';
        this.pannel.appendChild( this.body );

	}

	update ( samples ) {

		if ( ! this.body ) return;
		if ( ! Array.isArray( samples ) ) return;

		if ( samples.length === 0 ) {

			this.body.innerHTML = '<div style="color:rgba(180,210,240,0.5);">No history recorded yet.</div>';
			return;

		}

		const rows = samples.slice( -MAX_ROWS_SHOWN ).reverse();

		let html = '<table style="width:100%; border-collapse:collapse;">'
                 + '<tr style="color:rgba(180,210,240,0.6); text-align:left;">'
                 + '<th style="padding:2px 4px;">Tick</th><th style="padding:2px 4px;">Facilities</th>'
                 + '<th style="padding:2px 4px;">Treasury</th><th style="padding:2px 4px;">Congestion</th></tr>';

        for ( const s of rows ) {

			html += '<tr style="border-top:1px solid rgba(100,160,220,0.15);">'
                  + '<td style="padding:2px 4px;">' + s.tick + '</td>'
                  + '<td style="padding:2px 4px;">' + s.facilityCount + '</td>'
                  + '<td style="padding:2px 4px;">' + Math.round( s.treasury ) + '$</td>'
                  + '<td style="padding:2px 4px;">' + Math.round( s.avgCorridorUtilization * 100 ) + '%</td></tr>';

        }

        html += '</table>';
        this.body.innerHTML = html;

	}

}
