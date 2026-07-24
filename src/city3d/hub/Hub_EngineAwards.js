import { Hub_Pannel } from './Hub_Pannel.js';

// Real milestones from live region state - see
// engine/observability/AchievementTracker.js. Display only; the caller
// re-checks the tracker each tick and passes tracker.all() in.
export class Hub_EngineAwards extends Hub_Pannel {

	constructor( hub, isRight ) {

		super( hub, 'Awards', isRight );

	}

	init() {

		this.body = document.createElement('div');
        this.body.style.cssText = 'padding:10px 12px; pointer-events:none; overflow-y:auto; max-height:400px;';
        this.pannel.appendChild( this.body );

	}

	update ( achievements ) {

		if ( ! this.body ) return;
		if ( ! Array.isArray( achievements ) ) return;

		const unlockedCount = achievements.filter( a => a.unlocked ).length;

		let html = '<div style="font-size:11px; color:rgba(180,210,240,0.6); margin-bottom:8px;">'
                 + 'Progress: <span style="color:#4a9edd; font-weight:bold;">' + unlockedCount + '</span> / ' + achievements.length + '</div>';

        for ( const ach of achievements ) {

			const bgColor = ach.unlocked ? 'rgba(74,158,221,0.15)' : 'rgba(20,30,48,0.5)';
            const borderColor = ach.unlocked ? 'rgba(74,158,221,0.4)' : 'rgba(100,160,220,0.15)';
            const iconColor = ach.unlocked ? '#f0b84a' : 'rgba(180,210,240,0.3)';
            const nameColor = ach.unlocked ? '#dce8f5' : 'rgba(180,210,240,0.4)';
            const descColor = ach.unlocked ? 'rgba(180,210,240,0.7)' : 'rgba(180,210,240,0.25)';
            const icon = ach.unlocked ? '★' : '☆';
            const tickInfo = ach.unlocked ? ' <span style="opacity:0.6;">(tick ' + ach.unlockedTick + ')</span>' : '';

            html += '<div style="display:flex; align-items:center; gap:8px; padding:6px 8px; margin-bottom:4px;'
                  + ' background:' + bgColor + '; border:1px solid ' + borderColor + '; border-radius:6px;">'
                  + '<span style="font-size:18px; color:' + iconColor + ';">' + icon + '</span>'
                  + '<div><div style="font-size:12px; font-weight:600; color:' + nameColor + ';">' + ach.title + tickInfo + '</div>'
                  + '<div style="font-size:10px; color:' + descColor + ';">' + ach.description + '</div></div></div>';

        }

        this.body.innerHTML = html;

	}

}
