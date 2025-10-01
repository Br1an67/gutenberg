import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { NavigableRegion } from '@wordpress/admin-ui';
import {
	Button,
	privateApis as componentsPrivateApis,
	Icon,
	Path,
	SVG,
	Tooltip,
	VisuallyHidden,
} from '@wordpress/components';
import {
	useEvent,
	useMediaQuery,
	useMergeRefs,
	useRefEffect,
} from '@wordpress/compose';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	forwardRef,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { chevronDown, chevronUp } from '@wordpress/icons';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import { store as editPostStore } from '../../store';
import MetaBoxes from '../meta-boxes';

/** @type {{} & {useDrag: import('@use-gesture/react').useDrag}} */
const { useDrag } = unlock( componentsPrivateApis );

const magnet = (
	<SVG
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		style={ {
			stroke: 'currentColor',
			transform: `scale(${ 16 / 24 })`,
			strokeWidth: 1.5 / ( 16 / 24 ),
			strokeLinecap: 'round',
			strokeLinejoin: 'round',
			fill: 'none',
		} }
	>
		<Path d="m12 15 4 4" />
		<Path d="M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z" />
		<Path d="m5 8 4 4" />
	</SVG>
);

/**
 * @template T
 * @typedef { ReturnType< typeof useRefEffect< T > >} RefEffect
 */
/**
 * @template T, P
 * @typedef { ReturnType< typeof forwardRef< T, P > >} ForwardRef
 */
/**
 * Ref callback receiving the canvas element to add wheel event handling.
 * @typedef { RefEffect< HTMLBodyElement | HTMLDivElement > } EffectWheelResizing
 */
/**
 * @typedef MetaBoxesMainProps
 * @property { boolean } isLegacy True when the editor canvas is not in an iframe.
 */

/** @type {ForwardRef< EffectWheelResizing, MetaBoxesMainProps>} */
const MetaBoxesMain = forwardRef( ( { isLegacy }, ref ) => {
	const [ isOpen, openHeight, isAutoResize, hasAnyVisible ] = useSelect(
		( select ) => {
			const { get } = select( preferencesStore );
			const { isMetaBoxLocationVisible } = select( editPostStore );
			return [
				get( 'core/edit-post', 'metaBoxesMainIsOpen' ),
				get( 'core/edit-post', 'metaBoxesMainOpenHeight' ),
				get( 'core/edit-post', 'metaBoxesMainIsAutoResize' ),
				isMetaBoxLocationVisible( 'normal' ) ||
					isMetaBoxLocationVisible( 'advanced' ) ||
					isMetaBoxLocationVisible( 'side' ),
			];
		},
		[]
	);
	const { set: setPreference } = useDispatch( preferencesStore );

	const isShort = useMediaQuery( '(max-height: 549px)' );

	const [ { min, max }, setHeightConstraints ] = useState( () => ( {
		// These initial values don’t have to be accurate – the point of them
		// is to avoid NaN values in the intial render.
		min: 0,
		max: window.innerHeight,
	} ) );
	// Keeps the resizable area’s size constraints updated taking into account
	// editor notices. The constraints are also used to derive the value for the
	// aria-valuenow attribute on the separator.
	/** @type { RefEffect< HTMLElement > } */
	const effectSizeConstraints = useRefEffect( ( node ) => {
		const container = node.closest(
			'.interface-interface-skeleton__content'
		);
		if ( ! container ) {
			return;
		}
		const noticeLists = container.querySelectorAll(
			':scope > .components-notice-list'
		);
		const resizeHandle = container.querySelector(
			'.edit-post-meta-boxes-main__presenter'
		);
		const deriveConstraints = () => {
			const fullHeight = container.offsetHeight;
			let nextMax = fullHeight;
			for ( const element of noticeLists ) {
				nextMax -= element.offsetHeight;
			}
			const nextMin = resizeHandle.offsetHeight;
			setHeightConstraints( { min: nextMin, max: nextMax } );
		};
		const observer = new window.ResizeObserver( deriveConstraints );
		observer.observe( container );
		for ( const element of noticeLists ) {
			observer.observe( element );
		}
		return () => observer.disconnect();
	}, [] );
	const metaBoxesMainRef = useRef();
	const setMainRefs = useMergeRefs( [
		metaBoxesMainRef,
		effectSizeConstraints,
	] );

	const separatorRef = useRef();
	const separatorHelpId = useId();

	const heightRef = useRef();

	/**
	 * @param {number|'auto'} [height]       Height in pixels or 'auto'.
	 * @param {boolean}       [isPersistent] Whether to persist the height in preferences.
	 */
	const applyHeight = useEvent( ( height = 'auto', isPersistent = false ) => {
		let styleHeight;
		if ( height === 'auto' ) {
			isPersistent = false; // Just in case — “auto” should never persist.
			heightRef.current = undefined;
			styleHeight = height;
		} else {
			height = Math.min( max, Math.max( min, height ) );
			heightRef.current = height;
			styleHeight = `${ height }px`;
		}
		if ( isPersistent ) {
			setPreference(
				'core/edit-post',
				'metaBoxesMainOpenHeight',
				height
			);
		}
		metaBoxesMainRef.current.style.height = styleHeight;
		if ( ! isShort ) {
			separatorRef.current.ariaValueNow = Math.round(
				( ( height - min ) / ( max - min ) ) * 100
			);
		}
	} );

	// useDrag includes keyboard support with arrow keys emulating a drag.
	// TODO: Support more/all keyboard interactions from the window splitter pattern:
	// https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
	const bindDragGesture = useDrag(
		( { movement, first, last, memo, tap, args } ) => {
			const pane = metaBoxesMainRef.current;
			const [ , yMovement ] = movement;
			if ( first ) {
				pane.classList.add( 'is-resizing' );
				let fromHeight = heightRef.current ?? pane.offsetHeight;
				if ( isOpen ) {
					// Starts from max in case shortening the window has imposed it.
					if ( fromHeight > max ) {
						fromHeight = max;
					}
				} else {
					fromHeight = min;
				}
				applyHeight( fromHeight - yMovement );
				return { fromHeight };
			}

			if ( ! first && ! last && ! tap ) {
				applyHeight( memo.fromHeight - yMovement );
				return memo;
			}
			// Here, `last === true` – it’s the final event of the gesture.

			pane.classList.remove( 'is-resizing' );
			if ( tap ) {
				const [ onTap ] = args;
				onTap?.();
				return;
			}
			const nextIsOpen = heightRef.current > min;
			persistIsOpen( nextIsOpen );
			// Persists height only if still open. This is so that when closed by a drag the
			// prior height can be restored by the toggle button instead of having to drag
			// the pane open again.
			applyHeight( heightRef.current, nextIsOpen );
		},
		{ keyboardDisplacement: 20, filterTaps: true }
	);

	const linerRef = useRef();
	const getRenderValues = useEvent( () => ( { isOpen, min, openHeight } ) );

	/** @type { EffectWheelResizing } */
	const effectWheel = useRefEffect(
		( canvas ) => {
			if ( ! hasAnyVisible || ! isAutoResize ) {
				return;
			}
			const iframe = canvas.ownerDocument.defaultView.frameElement;
			if ( ! iframe ) {
				return;
			}
			const pane = metaBoxesMainRef.current;
			let isScrollMaxSticking = false;
			const iframeObserver = new window.ResizeObserver( () => {
				if ( isScrollMaxSticking ) {
					const { scrollingElement } = iframe.contentDocument;
					scrollingElement.scrollTop = scrollingElement.scrollHeight;
					isScrollMaxSticking = false;
				}
			} );
			iframeObserver.observe( iframe );
			/** @param { WheelEvent } event */
			const onWheel = ( event ) => {
				const { deltaY, currentTarget } = event;
				const { offsetHeight: canvasHeight, contentDocument } = iframe;
				const { scrollTop, scrollHeight } =
					contentDocument.scrollingElement;
				const scrollMax = scrollHeight - canvasHeight;
				if ( scrollMax - scrollTop >= 1 ) {
					return;
				}
				if ( pane === currentTarget ) {
					const isPaneScrolled = linerRef.current.scrollTop > 0;
					if ( isPaneScrolled && Math.sign( deltaY ) === -1 ) {
						return;
					}
					// While the canvas has height, prevents scrolling the meta boxes.
					if ( canvasHeight > 0 ) {
						event.preventDefault();
					}
				}
				isScrollMaxSticking = true;
				const renderValues = getRenderValues();
				const fromHeight = heightRef.current ?? pane.offsetHeight;
				const nextHeight = fromHeight + deltaY;
				if ( renderValues.isOpen && nextHeight <= renderValues.min ) {
					persistIsOpen( false, true );
				} else if (
					! renderValues.isOpen &&
					nextHeight > renderValues.min
				) {
					persistIsOpen( true, true );
				}
				applyHeight( nextHeight );
			};
			const canvasDocument = canvas.ownerDocument;
			canvasDocument.addEventListener( 'wheel', onWheel, {
				passive: true,
			} );
			pane.addEventListener( 'wheel', onWheel, { passive: false } );
			return () => {
				iframeObserver.disconnect();
				canvasDocument.removeEventListener( 'wheel', onWheel );
				pane.removeEventListener( 'wheel', onWheel );
			};
		},
		[ hasAnyVisible, isAutoResize ]
	);
	useImperativeHandle( ref, () => effectWheel, [ effectWheel ] );

	const ignoreChangeOfIsOpenInRenderRef = useRef( false );
	// Applies the height upon initial render, toggling (isOpen), and changing
	// of the media query (isShort). It skips application if `isOpen` changed
	// due to the wheel effect to not conflict with the height it set.
	useLayoutEffect( () => {
		if (
			hasAnyVisible &&
			! isLegacy &&
			! ignoreChangeOfIsOpenInRenderRef.current
		) {
			const renderValues = getRenderValues();
			const usedOpenHeight = isShort
				? 'auto'
				: renderValues.openHeight ?? 'auto';
			const usedHeight = isOpen ? usedOpenHeight : min;
			applyHeight( usedHeight );
		}
	}, [
		applyHeight,
		getRenderValues,
		hasAnyVisible,
		isLegacy,
		isOpen,
		isShort,
		min,
	] );

	if ( ! hasAnyVisible ) {
		return;
	}

	const contents = (
		<div
			// The class name 'edit-post-layout__metaboxes' is retained because some plugins use it.
			className="edit-post-layout__metaboxes edit-post-meta-boxes-main__liner"
			hidden={ ! isLegacy && ! isOpen }
			ref={ ! isLegacy ? linerRef : null }
		>
			<MetaBoxes location="normal" />
			<MetaBoxes location="advanced" />
		</div>
	);

	if ( isLegacy ) {
		return contents;
	}

	const persistIsOpen = ( to = ! isOpen, flagIgnoreInRender = false ) => {
		setPreference( 'core/edit-post', 'metaBoxesMainIsOpen', to );
		ignoreChangeOfIsOpenInRenderRef.current = flagIgnoreInRender;
	};

	const paneLabel = __( 'Meta Boxes' );

	// The toggle button. It also resizes when the viewport is tall to provide
	// a larger hit area than the small separator button.
	const toggle = (
		<button
			aria-expanded={ isOpen }
			// Toggles for all clicks when short and only keyboard “clicks” when
			// resizable because pointer input is handled by the drag gesture.
			onClick={ ( { detail } ) => {
				if ( isShort || ! detail ) {
					persistIsOpen();
				}
			} }
			// Passes a toggle callback that the drag gesture handler calls when
			// it interprets the input as a click/tap.
			{ ...( ! isShort && bindDragGesture( persistIsOpen ) ) }
		>
			{ paneLabel }
			<Icon icon={ isOpen ? chevronUp : chevronDown } />
		</button>
	);

	// The separator button that provides a11y for resizing. Its aria-valuenow
	// attribute is set imperatively which is why it does not appear in JSX.
	const separator = ! isShort && (
		<>
			<Tooltip text={ __( 'Drag to resize' ) }>
				<button
					ref={ separatorRef }
					role="separator" // eslint-disable-line jsx-a11y/no-interactive-element-to-noninteractive-role
					aria-label={ __( 'Drag to resize' ) }
					aria-describedby={ separatorHelpId }
					{ ...bindDragGesture() }
				/>
			</Tooltip>
			<VisuallyHidden id={ separatorHelpId }>
				{ __(
					'Use up and down arrow keys to resize the meta box pane.'
				) }
			</VisuallyHidden>
		</>
	);

	return (
		<NavigableRegion
			aria-label={ paneLabel }
			ref={ setMainRefs }
			className={ clsx(
				'edit-post-meta-boxes-main',
				! isShort && 'is-resizable'
			) }
		>
			<div className="edit-post-meta-boxes-main__presenter">
				{ toggle }
				{ separator }
				<Button
					label={ __( 'Enable auto-resizing' ) }
					showTooltip
					size="small"
					icon={ magnet }
					onClick={ () =>
						setPreference(
							'core/edit-post',
							'metaBoxesMainIsAutoResize',
							! isAutoResize
						)
					}
					isPressed={ isAutoResize }
				/>
			</div>
			{ contents }
		</NavigableRegion>
	);
} );

MetaBoxesMain.displayName = 'MetaBoxesMain';

export default MetaBoxesMain;
