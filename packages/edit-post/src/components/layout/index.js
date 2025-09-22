/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import {
	AutosaveMonitor,
	LocalAutosaveMonitor,
	UnsavedChangesWarning,
	EditorKeyboardShortcutsRegister,
	EditorSnackbars,
	ErrorBoundary,
	PostLockedModal,
	store as editorStore,
	privateApis as editorPrivateApis,
} from '@wordpress/editor';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getLayoutStyles } from '@wordpress/global-styles-engine';
import { PluginArea } from '@wordpress/plugins';
import { __, sprintf } from '@wordpress/i18n';
import { useCallback, useMemo } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';
import { store as preferencesStore } from '@wordpress/preferences';
import { privateApis as commandsPrivateApis } from '@wordpress/commands';
import { privateApis as blockLibraryPrivateApis } from '@wordpress/block-library';
import { addQueryArgs } from '@wordpress/url';
import { decodeEntities } from '@wordpress/html-entities';
import { store as coreStore } from '@wordpress/core-data';
import {
	SlotFillProvider,
	__unstableUseNavigateRegions as useNavigateRegions,
} from '@wordpress/components';
import { useViewportMatch } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import BackButton from '../back-button';
import EditorInitialization from '../editor-initialization';
import EditPostKeyboardShortcuts from '../keyboard-shortcuts';
import InitPatternModal from '../init-pattern-modal';
import BrowserURL from '../browser-url';
import MetaBoxes from '../meta-boxes';
import MetaBoxesMain from '../meta-boxes-main';
import PostEditorMoreMenu from '../more-menu';
import WelcomeGuide from '../welcome-guide';
import { store as editPostStore } from '../../store';
import { unlock } from '../../lock-unlock';
import useEditPostCommands from '../../commands/use-commands';
import { useShouldIframe } from './use-should-iframe';
import useNavigateToEntityRecord from '../../hooks/use-navigate-to-entity-record';
import { useMetaBoxInitialization } from '../meta-boxes/use-meta-box-initialization';

const { useCommandContext } = unlock( commandsPrivateApis );
const { Editor, FullscreenMode } = unlock( editorPrivateApis );
const { BlockKeyboardShortcuts } = unlock( blockLibraryPrivateApis );
const DESIGN_POST_TYPES = [
	'wp_template',
	'wp_template_part',
	'wp_block',
	'wp_navigation',
];

function useEditorStyles( settings ) {
	const { hasThemeStyleSupport } = useSelect( ( select ) => {
		return {
			hasThemeStyleSupport:
				select( editPostStore ).isFeatureActive( 'themeStyles' ),
		};
	}, [] );

	// Compute the default styles.
	return useMemo( () => {
		const presetStyles =
			settings.styles?.filter(
				( style ) =>
					style.__unstableType && style.__unstableType !== 'theme'
			) ?? [];

		const defaultEditorStyles = [
			...( settings?.defaultEditorStyles ?? [] ),
			...presetStyles,
		];

		// Has theme styles if the theme supports them and if some styles were not preset styles (in which case they're theme styles).
		const hasThemeStyles =
			hasThemeStyleSupport &&
			presetStyles.length !== ( settings.styles?.length ?? 0 );

		// If theme styles are not present or displayed, ensure that
		// base layout styles are still present in the editor.
		if ( ! settings.disableLayoutStyles && ! hasThemeStyles ) {
			defaultEditorStyles.push( {
				css: getLayoutStyles( {
					style: {},
					selector: 'body',
					hasBlockGapSupport: false,
					hasFallbackGapSupport: true,
					fallbackGapValue: '0.5em',
				} ),
			} );
		}

		return hasThemeStyles ? settings.styles ?? [] : defaultEditorStyles;
	}, [
		settings.defaultEditorStyles,
		settings.disableLayoutStyles,
		settings.styles,
		hasThemeStyleSupport,
	] );
}

function Layout( {
	postId: initialPostId,
	postType: initialPostType,
	settings,
	initialEdits,
} ) {
	useEditPostCommands();
	const shouldIframe = useShouldIframe();
	const { createErrorNotice } = useDispatch( noticesStore );
	const {
		currentPost: { postId: currentPostId, postType: currentPostType },
		onNavigateToEntityRecord,
		onNavigateToPreviousEntityRecord,
		previousSelectedBlockPath,
	} = useNavigateToEntityRecord(
		initialPostId,
		initialPostType,
		'post-only'
	);
	const isEditingTemplate = currentPostType === 'wp_template';
	const {
		mode,
		isFullscreenActive,
		hasResolvedMode,
		hasActiveMetaboxes,
		hasBlockSelected,
		showIconLabels,
		isDistractionFree,
		showMetaBoxes,
		isWelcomeGuideVisible,
		templateId,
		isDevicePreview,
	} = useSelect(
		( select ) => {
			const { get } = select( preferencesStore );
			const { isFeatureActive, hasMetaBoxes } = select( editPostStore );
			const { canUser, getPostType, getTemplateId } = unlock(
				select( coreStore )
			);

			const supportsTemplateMode = settings.supportsTemplateMode;
			const isViewable =
				getPostType( currentPostType )?.viewable ?? false;
			const canViewTemplate = canUser( 'read', {
				kind: 'postType',
				name: 'wp_template',
			} );
			const { getBlockSelectionStart, isZoomOut } = unlock(
				select( blockEditorStore )
			);
			const { getEditorMode, getDefaultRenderingMode, getDeviceType } =
				unlock( select( editorStore ) );
			const isNotDesignPostType =
				! DESIGN_POST_TYPES.includes( currentPostType );
			const isDirectlyEditingPattern =
				currentPostType === 'wp_block' &&
				! onNavigateToPreviousEntityRecord;
			const _templateId = getTemplateId( currentPostType, currentPostId );
			const defaultMode = getDefaultRenderingMode( currentPostType );

			return {
				mode: getEditorMode(),
				isFullscreenActive: isFeatureActive( 'fullscreenMode' ),
				hasActiveMetaboxes: hasMetaBoxes(),
				hasResolvedMode:
					defaultMode === 'template-locked'
						? !! _templateId
						: defaultMode !== undefined,
				hasBlockSelected: !! getBlockSelectionStart(),
				showIconLabels: get( 'core', 'showIconLabels' ),
				isDistractionFree: get( 'core', 'distractionFree' ),
				showMetaBoxes:
					( isNotDesignPostType && ! isZoomOut() ) ||
					isDirectlyEditingPattern,
				isWelcomeGuideVisible: isFeatureActive( 'welcomeGuide' ),
				templateId:
					supportsTemplateMode &&
					isViewable &&
					canViewTemplate &&
					! isEditingTemplate
						? _templateId
						: null,
				isDevicePreview: getDeviceType() !== 'Desktop',
			};
		},
		[
			currentPostType,
			currentPostId,
			isEditingTemplate,
			settings.supportsTemplateMode,
			onNavigateToPreviousEntityRecord,
		]
	);

	useMetaBoxInitialization( hasActiveMetaboxes && hasResolvedMode );

	// Set the right context for the command palette
	const commandContext = hasBlockSelected
		? 'block-selection-edit'
		: 'entity-edit';
	useCommandContext( commandContext );
	const styles = useEditorStyles( settings );
	const editorSettings = useMemo(
		() => ( {
			...settings,
			styles,
			onNavigateToEntityRecord,
			onNavigateToPreviousEntityRecord,
			defaultRenderingMode: 'post-only',
		} ),
		[
			settings,
			styles,
			onNavigateToEntityRecord,
			onNavigateToPreviousEntityRecord,
		]
	);

	// We need to add the show-icon-labels class to the body element so it is applied to modals.
	if ( showIconLabels ) {
		document.body.classList.add( 'show-icon-labels' );
	} else {
		document.body.classList.remove( 'show-icon-labels' );
	}

	const navigateRegionsProps = useNavigateRegions();

	const className = clsx( 'edit-post-layout', 'is-mode-' + mode, {
		'has-metaboxes': hasActiveMetaboxes,
	} );

	function onPluginAreaError( name ) {
		createErrorNotice(
			sprintf(
				/* translators: %s: plugin name */
				__(
					'The "%s" plugin has encountered an error and cannot be rendered.'
				),
				name
			)
		);
	}

	const { createSuccessNotice } = useDispatch( noticesStore );

	const onActionPerformed = useCallback(
		( actionId, items ) => {
			switch ( actionId ) {
				case 'move-to-trash':
					{
						document.location.href = addQueryArgs( 'edit.php', {
							trashed: 1,
							post_type: items[ 0 ].type,
							ids: items[ 0 ].id,
						} );
					}
					break;
				case 'duplicate-post':
					{
						const newItem = items[ 0 ];
						const title =
							typeof newItem.title === 'string'
								? newItem.title
								: newItem.title?.rendered;
						createSuccessNotice(
							sprintf(
								// translators: %s: Title of the created post or template, e.g: "Hello world".
								__( '"%s" successfully created.' ),
								decodeEntities( title ) || __( '(no title)' )
							),
							{
								type: 'snackbar',
								id: 'duplicate-post-action',
								actions: [
									{
										label: __( 'Edit' ),
										onClick: () => {
											const postId = newItem.id;
											document.location.href =
												addQueryArgs( 'post.php', {
													post: postId,
													action: 'edit',
												} );
										},
									},
								],
							}
						);
					}
					break;
			}
		},
		[ createSuccessNotice ]
	);

	const initialPost = useMemo( () => {
		return {
			type: initialPostType,
			id: initialPostId,
		};
	}, [ initialPostType, initialPostId ] );

	const backButton =
		useViewportMatch( 'medium' ) && isFullscreenActive ? (
			<BackButton initialPost={ initialPost } />
		) : null;

	return (
		<SlotFillProvider>
			<ErrorBoundary canCopyContent>
				<WelcomeGuide postType={ currentPostType } />
				<div
					className={ navigateRegionsProps.className }
					{ ...navigateRegionsProps }
					ref={ navigateRegionsProps.ref }
				>
					<Editor
						settings={ editorSettings }
						initialEdits={ initialEdits }
						postType={ currentPostType }
						postId={ currentPostId }
						templateId={ templateId }
						className={ className }
						forceIsDirty={ hasActiveMetaboxes }
						disableIframe={ ! shouldIframe }
						// We should auto-focus the canvas (title) on load.
						// eslint-disable-next-line jsx-a11y/no-autofocus
						autoFocus={ ! isWelcomeGuideVisible }
						onActionPerformed={ onActionPerformed }
						initialSelection={ previousSelectedBlockPath }
						extraSidebarPanels={
							showMetaBoxes && <MetaBoxes location="side" />
						}
						extraContent={
							! isDistractionFree &&
							showMetaBoxes && (
								<MetaBoxesMain
									isLegacy={
										! shouldIframe || isDevicePreview
									}
								/>
							)
						}
					>
						<PostLockedModal />
						<EditorInitialization />
						<FullscreenMode isActive={ isFullscreenActive } />
						<BrowserURL />
						<UnsavedChangesWarning />
						<AutosaveMonitor />
						<LocalAutosaveMonitor />
						<EditPostKeyboardShortcuts />
						<EditorKeyboardShortcutsRegister />
						<BlockKeyboardShortcuts />
						{ currentPostType === 'wp_block' && (
							<InitPatternModal />
						) }
						<PluginArea onError={ onPluginAreaError } />
						<PostEditorMoreMenu />
						{ backButton }
						<EditorSnackbars />
					</Editor>
				</div>
			</ErrorBoundary>
		</SlotFillProvider>
	);
}

export default Layout;
