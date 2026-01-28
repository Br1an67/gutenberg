/**
 * WordPress dependencies
 */
import { store, getContext, getElement } from '@wordpress/interactivity';

// Get WaveSurfer from window - it will be loaded via wp_enqueue_script
const getWaveSurfer = () => window.WaveSurfer;

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
		togglePlayPause() {
			const context = getContext();
			const player = state.players[ context.playlistId ];
			if ( player ) {
				player.playPause();
			}
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
		initWaveSurfer() {
			const context = getContext();

			// Only initialize if not already done
			if ( state.players[ context.playlistId ] ) {
				return;
			}

			const WaveSurfer = getWaveSurfer();
			if ( ! WaveSurfer ) {
				// eslint-disable-next-line no-console
				console.error( 'WaveSurfer is not loaded' );
				return;
			}

			const { ref } = getElement();

			// Get the computed color from the container
			const containerStyles = window.getComputedStyle( ref );
			const color = containerStyles.getPropertyValue( 'color' );

			const wavesurfer = WaveSurfer.create( {
				container: ref,
				waveColor: `color-mix(in srgb, ${ color } 20%, #808080)`,
				progressColor: color,
				cursorColor: color,
				cursorWidth: 2,
				barWidth: 2,
				barRadius: 0,
				height: 80,
				barGap: 2,
				responsive: true,
			} );

			state.players[ context.playlistId ] = wavesurfer;

			// Wire up WaveSurfer events to Interactivity API
			wavesurfer.on( 'play', () => {
				context.isPlaying = true;
			} );

			wavesurfer.on( 'pause', () => {
				context.isPlaying = false;
			} );

			wavesurfer.on( 'finish', () => {
				// Trigger next song
				const currentIndex = context.tracks.findIndex(
					( uniqueId ) => uniqueId === context.currentId
				);
				const nextTrack = context.tracks[ currentIndex + 1 ];
				if ( nextTrack ) {
					context.currentId = nextTrack;
					setTimeout( () => {
						wavesurfer.play();
					}, 1000 );
				}
			} );
		},
		loadTrack() {
			const context = getContext();
			const player = state.players[ context.playlistId ];
			const trackUrl = state.currentTrack.url;

			if ( player && trackUrl ) {
				player.load( trackUrl );
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
