/**
 * External dependencies
 */
import Plyr from 'plyr';

/**
 * WordPress dependencies
 */
import { store, getContext, getElement } from '@wordpress/interactivity';

const { state } = store( 'core/playlist', {
	state: {
		playlists: {},
		players: {},
		get currentTrack() {
			const { currentId, playlistId } = getContext();
			if ( ! currentId || ! playlistId ) {
				return {};
			}
			const playlist = this.playlists[ playlistId ];
			if ( ! playlist ) {
				return {};
			}
			return playlist.tracks[ currentId ] || {};
		},
		get isCurrentTrack() {
			const { currentId, uniqueId } = getContext();
			return currentId === uniqueId;
		},
	},
	actions: {
		changeTrack() {
			const context = getContext();
			context.currentId = context.uniqueId;
			context.isPlaying = true;
		},
		isPlaying() {
			const context = getContext();
			context.isPlaying = true;
		},
		isPaused() {
			const context = getContext();
			context.isPlaying = false;
		},
		nextSong() {
			const context = getContext();
			const currentIndex = context.tracks.findIndex(
				( uniqueId ) => uniqueId === context.currentId
			);
			const nextTrack = context.tracks[ currentIndex + 1 ];
			if ( nextTrack ) {
				context.currentId = nextTrack;
				const player = state.players[ context.playlistId ];
				// Waits a moment before changing the track, since
				// immediately changing the track can be jarring.
				setTimeout( () => {
					if ( player ) {
						player.play();
					}
				}, 1000 );
			}
		},
	},
	callbacks: {
		initPlyr() {
			const context = getContext();
			const { ref } = getElement();

			// Only initialize if not already done
			if ( ! state.players[ context.playlistId ] ) {
				const player = new Plyr( ref, {
					controls: [
						'play',
						'progress',
						'current-time',
						'mute',
						'volume',
					],
				} );

				state.players[ context.playlistId ] = player;

				// Wire up Plyr events to Interactivity API
				player.on( 'play', () => {
					context.isPlaying = true;
				} );

				player.on( 'pause', () => {
					context.isPlaying = false;
				} );

				player.on( 'ended', () => {
					// Trigger next song
					const currentIndex = context.tracks.findIndex(
						( uniqueId ) => uniqueId === context.currentId
					);
					const nextTrack = context.tracks[ currentIndex + 1 ];
					if ( nextTrack ) {
						context.currentId = nextTrack;
						setTimeout( () => {
							player.play();
						}, 1000 );
					}
				} );
			}
		},
		autoPlay() {
			const context = getContext();
			const player = state.players[ context.playlistId ];
			if ( context.currentId && context.isPlaying && player ) {
				player.play();
			}
		},
	},
} );
