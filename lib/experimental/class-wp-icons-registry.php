<?php

if ( ! class_exists( 'WP_Icons_Registry' ) ) {
	class WP_Icons_Registry {
		/**
		 * Registered icons array.
		 *
		 * @var array[]
		 */
		private $registered_icons = array();


		/**
		 * Container for the main instance of the class.
		 *
		 * @var WP_Icons_Registry|null
		 */
		private static $instance = null;

		/**
		 * Constructor.
		 *
		 * WP_Icons_Registry is a singleton class, so keep this private.
		 */
		private function __construct() {
			$icons_directory = __DIR__ . '/../../packages/icons/src/';
			$icons_directory = trailingslashit( $icons_directory );
			$manifest_path   = $icons_directory . 'manifest.php';

			if ( ! is_readable( $manifest_path ) ) {
				wp_trigger_error(
					__METHOD__,
					__( 'Core icon collection manifest is missing or unreadable.', 'gutenberg' )
				);
				return;
			}

			$collection = include $manifest_path;

			if ( empty( $collection ) ) {
				wp_trigger_error(
					__METHOD__,
					__( 'Core icon collection manifest is empty or invalid.', 'gutenberg' )
				);
				return;
			}

			foreach ( $collection as $icon_name => $icon_data ) {
				if (
					empty( $icon_data['filePath'] )
					|| ! is_string( $icon_data['filePath'] )
				) {
					_doing_it_wrong(
						__METHOD__,
						__( 'Core icon collection manifest must provide valid a "filePath" for each icon.', 'gutenberg' ),
						'7.0.0'
					);
					return;
				}

				$this->register(
					'core/' . $icon_name,
					array(
						'label'    => $icon_data['label'],
						'filePath' => $icons_directory . $icon_data['filePath'],
					)
				);
			}
		}

		/**
		 * Registers an icon.
		 *
		 * @param string $icon_name       Icon name including namespace.
		 * @param array  $icon_properties {
		 *     List of properties for the icon.
		 *
		 *     @type string $label    Required. A human-readable label for the icon.
		 *     @type string $content  Optional. SVG markup for the icon.
		 *                            If not provided, the content will be retrieved from the `filePath` if set.
		 *                            If both `content` and `filePath` are not set, the icon will not be registered.
		 *     @type string $filePath Optional. The full path to the file containing the icon content.
		 * }
		 * @return bool True if the icon was registered with success and false otherwise.
		 */
		private function register( $icon_name, $icon_properties ) {
			if ( ! isset( $icon_name ) || ! is_string( $icon_name ) ) {
				_doing_it_wrong(
					__METHOD__,
					__( 'Icon name must be a string.', 'gutenberg' ),
					'7.0.0'
				);
				return false;
			}

			$allowed_keys = array_fill_keys( array( 'label', 'content', 'filePath' ), 1 );
			foreach ( array_keys( $icon_properties ) as $key ) {
				if ( ! array_key_exists( $key, $allowed_keys ) ) {
					_doing_it_wrong(
						__METHOD__,
						sprintf(
							// translators: %s is the name of any user-provided key
							__( 'Invalid icon property: "%s".', 'gutenberg' ),
							$key
						),
						'7.0.0'
					);
					return false;
				}
			}

			if ( ! isset( $icon_properties['label'] ) || ! is_string( $icon_properties['label'] ) ) {
				_doing_it_wrong(
					__METHOD__,
					__( 'Icon label must be a string.', 'gutenberg' ),
					'7.0.0'
				);
				return false;
			}

			if (
				( ! isset( $icon_properties['content'] ) && ! isset( $icon_properties['filePath'] ) ) ||
				( isset( $icon_properties['content'] ) && isset( $icon_properties['filePath'] ) )
			) {
				_doing_it_wrong(
					__METHOD__,
					__( 'Icons must provide either `content` or `filePath`.', 'gutenberg' ),
					'7.0.0'
				);
				return false;
			}

			if ( isset( $icon_properties['content'] ) ) {
				if ( ! is_string( $icon_properties['content'] ) ) {
					_doing_it_wrong(
						__METHOD__,
						__( 'Icon content must be a string.', 'gutenberg' ),
						'7.0.0'
					);
					return false;
				}

				$sanitized_icon_content = $this->sanitize_icon_content( $icon_properties['content'] );
				if ( empty( $sanitized_icon_content ) ) {
					_doing_it_wrong(
						__METHOD__,
						__( 'Icon content does not contain valid SVG markup.', 'gutenberg' ),
						'7.0.0'
					);
					return false;
				}
			}

			$icon = array_merge(
				$icon_properties,
				array( 'name' => $icon_name )
			);

			$this->registered_icons[ $icon_name ] = $icon;

			return true;
		}

		/**
		 * Sanitizes the icon SVG content.
		 * Strips disallowed tags and attributes, and ensures the content is valid SVG markup.
		 * If the content is not valid SVG markup, returns an empty string.
		 *
		 * @param string $icon_content The icon SVG content to sanitize.
		 * @return string The sanitized icon SVG content.
		 */
		private function sanitize_icon_content( $icon_content ) {
			// Core attributes applicable to most elements.
			$core_attributes = array(
				'id'    => true,
				'class' => true,
				'style' => true,
			);

			// ARIA and accessibility attributes.
			$aria_attributes = array(
				'aria-hidden'      => true,
				'aria-label'       => true,
				'aria-labelledby'  => true,
				'aria-describedby' => true,
				'role'             => true,
				'focusable'        => true,
				'tabindex'         => true,
			);

			// Presentation attributes for graphics elements (shapes, text, use, image).
			$presentation_attributes = array(
				'fill'                => true,
				'fill-opacity'        => true,
				'fill-rule'           => true,
				'stroke'              => true,
				'stroke-width'        => true,
				'stroke-linecap'      => true,
				'stroke-linejoin'     => true,
				'stroke-miterlimit'   => true,
				'stroke-dasharray'    => true,
				'stroke-dashoffset'   => true,
				'stroke-opacity'      => true,
				'opacity'             => true,
				'transform'           => true,
				'clip-path'           => true,
				'clip-rule'           => true,
				'mask'                => true,
				'filter'              => true,
				'visibility'          => true,
				'display'             => true,
				'color'               => true,
				'color-interpolation' => true,
				'color-rendering'     => true,
				'vector-effect'       => true,
				'paint-order'         => true,
			);

			// Marker attributes (only for shape elements).
			$marker_attributes = array(
				'marker-start' => true,
				'marker-mid'   => true,
				'marker-end'   => true,
			);

			// Container attributes for grouping elements.
			$container_attributes = array(
				'transform'  => true,
				'clip-path'  => true,
				'mask'       => true,
				'filter'     => true,
				'visibility' => true,
				'display'    => true,
				'opacity'    => true,
			);

			$allowed_tags = array(
				// Root SVG element.
				'svg'                 => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					array(
						'xmlns'               => true,
						'xmlns:xlink'         => true,
						'width'               => true,
						'height'              => true,
						'viewbox'             => true,
						'preserveaspectratio' => true,
						'x'                   => true,
						'y'                   => true,
					)
				),
				// Basic shape elements (with markers).
				'path'                => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					$marker_attributes,
					array(
						'd'          => true,
						'pathLength' => true,
					)
				),
				'circle'              => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					$marker_attributes,
					array(
						'cx' => true,
						'cy' => true,
						'r'  => true,
					)
				),
				'ellipse'             => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					$marker_attributes,
					array(
						'cx' => true,
						'cy' => true,
						'rx' => true,
						'ry' => true,
					)
				),
				'line'                => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					$marker_attributes,
					array(
						'x1' => true,
						'x2' => true,
						'y1' => true,
						'y2' => true,
					)
				),
				'polygon'             => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					$marker_attributes,
					array(
						'points' => true,
					)
				),
				'polyline'            => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					$marker_attributes,
					array(
						'points' => true,
					)
				),
				'rect'                => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					$marker_attributes,
					array(
						'x'      => true,
						'y'      => true,
						'width'  => true,
						'height' => true,
						'rx'     => true,
						'ry'     => true,
					)
				),
				// Grouping and structural elements.
				'g'                   => array_merge(
					$core_attributes,
					$aria_attributes,
					$container_attributes
				),
				'defs'                => $core_attributes,
				'symbol'              => array_merge(
					$core_attributes,
					$aria_attributes,
					$container_attributes,
					array(
						'viewBox'             => true,
						'preserveAspectRatio' => true,
						'x'                   => true,
						'y'                   => true,
						'width'               => true,
						'height'              => true,
					)
				),
				'use'                 => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					array(
						'href'       => true,
						'xlink:href' => true,
						'x'          => true,
						'y'          => true,
						'width'      => true,
						'height'     => true,
					)
				),
				'clipPath'            => array_merge(
					$core_attributes,
					array(
						'clipPathUnits' => true,
						'transform'     => true,
					)
				),
				'mask'                => array_merge(
					$core_attributes,
					array(
						'x'                => true,
						'y'                => true,
						'width'            => true,
						'height'           => true,
						'maskUnits'        => true,
						'maskContentUnits' => true,
					)
				),
				// Gradient elements.
				'linearGradient'      => array_merge(
					$core_attributes,
					array(
						'x1'                => true,
						'x2'                => true,
						'y1'                => true,
						'y2'                => true,
						'gradientUnits'     => true,
						'gradientTransform' => true,
						'spreadMethod'      => true,
						'href'              => true,
						'xlink:href'        => true,
					)
				),
				'radialGradient'      => array_merge(
					$core_attributes,
					array(
						'cx'                => true,
						'cy'                => true,
						'r'                 => true,
						'fx'                => true,
						'fy'                => true,
						'fr'                => true,
						'gradientUnits'     => true,
						'gradientTransform' => true,
						'spreadMethod'      => true,
						'href'              => true,
						'xlink:href'        => true,
					)
				),
				'stop'                => array_merge(
					$core_attributes,
					array(
						'offset'       => true,
						'stop-color'   => true,
						'stop-opacity' => true,
					)
				),
				// Pattern element.
				'pattern'             => array_merge(
					$core_attributes,
					array(
						'x'                   => true,
						'y'                   => true,
						'width'               => true,
						'height'              => true,
						'patternUnits'        => true,
						'patternContentUnits' => true,
						'patternTransform'    => true,
						'viewBox'             => true,
						'preserveAspectRatio' => true,
						'href'                => true,
						'xlink:href'          => true,
					)
				),
				// Filter elements.
				'filter'              => array_merge(
					$core_attributes,
					array(
						'x'              => true,
						'y'              => true,
						'width'          => true,
						'height'         => true,
						'filterUnits'    => true,
						'primitiveUnits' => true,
					)
				),
				'feBlend'             => array(
					'in'     => true,
					'in2'    => true,
					'mode'   => true,
					'result' => true,
				),
				'feColorMatrix'       => array(
					'in'     => true,
					'type'   => true,
					'values' => true,
					'result' => true,
				),
				'feComponentTransfer' => array(
					'in'     => true,
					'result' => true,
				),
				'feComposite'         => array(
					'in'       => true,
					'in2'      => true,
					'operator' => true,
					'k1'       => true,
					'k2'       => true,
					'k3'       => true,
					'k4'       => true,
					'result'   => true,
				),
				'feConvolveMatrix'    => array(
					'in'            => true,
					'order'         => true,
					'kernelMatrix'  => true,
					'divisor'       => true,
					'bias'          => true,
					'targetX'       => true,
					'targetY'       => true,
					'edgeMode'      => true,
					'preserveAlpha' => true,
					'result'        => true,
				),
				'feDiffuseLighting'   => array(
					'in'              => true,
					'surfaceScale'    => true,
					'diffuseConstant' => true,
					'result'          => true,
				),
				'feDisplacementMap'   => array(
					'in'               => true,
					'in2'              => true,
					'scale'            => true,
					'xChannelSelector' => true,
					'yChannelSelector' => true,
					'result'           => true,
				),
				'feDistantLight'      => array(
					'azimuth'   => true,
					'elevation' => true,
				),
				'feFlood'             => array(
					'flood-color'   => true,
					'flood-opacity' => true,
					'result'        => true,
				),
				'feGaussianBlur'      => array(
					'in'           => true,
					'stdDeviation' => true,
					'edgeMode'     => true,
					'result'       => true,
				),
				'feImage'             => array(
					'href'                => true,
					'xlink:href'          => true,
					'preserveAspectRatio' => true,
					'result'              => true,
				),
				'feMerge'             => array(
					'result' => true,
				),
				'feMergeNode'         => array(
					'in' => true,
				),
				'feMorphology'        => array(
					'in'       => true,
					'operator' => true,
					'radius'   => true,
					'result'   => true,
				),
				'feOffset'            => array(
					'in'     => true,
					'dx'     => true,
					'dy'     => true,
					'result' => true,
				),
				'fePointLight'        => array(
					'x' => true,
					'y' => true,
					'z' => true,
				),
				'feSpecularLighting'  => array(
					'in'               => true,
					'surfaceScale'     => true,
					'specularConstant' => true,
					'specularExponent' => true,
					'result'           => true,
				),
				'feSpotLight'         => array(
					'x'                 => true,
					'y'                 => true,
					'z'                 => true,
					'pointsAtX'         => true,
					'pointsAtY'         => true,
					'pointsAtZ'         => true,
					'specularExponent'  => true,
					'limitingConeAngle' => true,
				),
				'feTile'              => array(
					'in'     => true,
					'result' => true,
				),
				'feTurbulence'        => array(
					'baseFrequency' => true,
					'numOctaves'    => true,
					'seed'          => true,
					'stitchTiles'   => true,
					'type'          => true,
					'result'        => true,
				),
				'feFuncA'             => array(
					'type'        => true,
					'tableValues' => true,
					'slope'       => true,
					'intercept'   => true,
					'amplitude'   => true,
					'exponent'    => true,
					'offset'      => true,
				),
				'feFuncB'             => array(
					'type'        => true,
					'tableValues' => true,
					'slope'       => true,
					'intercept'   => true,
					'amplitude'   => true,
					'exponent'    => true,
					'offset'      => true,
				),
				'feFuncG'             => array(
					'type'        => true,
					'tableValues' => true,
					'slope'       => true,
					'intercept'   => true,
					'amplitude'   => true,
					'exponent'    => true,
					'offset'      => true,
				),
				'feFuncR'             => array(
					'type'        => true,
					'tableValues' => true,
					'slope'       => true,
					'intercept'   => true,
					'amplitude'   => true,
					'exponent'    => true,
					'offset'      => true,
				),
				// Text elements.
				'text'                => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					array(
						'x'                  => true,
						'y'                  => true,
						'dx'                 => true,
						'dy'                 => true,
						'rotate'             => true,
						'textLength'         => true,
						'lengthAdjust'       => true,
						'text-anchor'        => true,
						'font-family'        => true,
						'font-size'          => true,
						'font-weight'        => true,
						'font-style'         => true,
						'font-variant'       => true,
						'text-decoration'    => true,
						'writing-mode'       => true,
						'letter-spacing'     => true,
						'word-spacing'       => true,
						'dominant-baseline'  => true,
						'alignment-baseline' => true,
						'baseline-shift'     => true,
					)
				),
				'tspan'               => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					array(
						'x'               => true,
						'y'               => true,
						'dx'              => true,
						'dy'              => true,
						'rotate'          => true,
						'textLength'      => true,
						'lengthAdjust'    => true,
						'text-anchor'     => true,
						'font-family'     => true,
						'font-size'       => true,
						'font-weight'     => true,
						'font-style'      => true,
						'text-decoration' => true,
					)
				),
				'textPath'            => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					array(
						'href'        => true,
						'xlink:href'  => true,
						'startOffset' => true,
						'method'      => true,
						'spacing'     => true,
						'text-anchor' => true,
					)
				),
				// Descriptive elements.
				'title'               => array(),
				'desc'                => array(),
				'metadata'            => array(),
				// Image element.
				'image'               => array_merge(
					$core_attributes,
					$aria_attributes,
					$presentation_attributes,
					array(
						'x'                   => true,
						'y'                   => true,
						'width'               => true,
						'height'              => true,
						'href'                => true,
						'xlink:href'          => true,
						'preserveAspectRatio' => true,
					)
				),
				// Marker element.
				'marker'              => array_merge(
					$core_attributes,
					array(
						'markerUnits'         => true,
						'refX'                => true,
						'refY'                => true,
						'markerWidth'         => true,
						'markerHeight'        => true,
						'orient'              => true,
						'preserveAspectRatio' => true,
						'viewBox'             => true,
					)
				),
				// Animation elements.
				'animate'             => array_merge(
					$core_attributes,
					array(
						'attributeName' => true,
						'from'          => true,
						'to'            => true,
						'dur'           => true,
						'repeatCount'   => true,
						'begin'         => true,
						'end'           => true,
						'values'        => true,
						'keyTimes'      => true,
						'keySplines'    => true,
						'calcMode'      => true,
						'additive'      => true,
						'accumulate'    => true,
					)
				),
				'animateTransform'    => array_merge(
					$core_attributes,
					array(
						'attributeName' => true,
						'type'          => true,
						'from'          => true,
						'to'            => true,
						'dur'           => true,
						'repeatCount'   => true,
						'begin'         => true,
						'end'           => true,
						'values'        => true,
						'keyTimes'      => true,
						'keySplines'    => true,
						'calcMode'      => true,
						'additive'      => true,
						'accumulate'    => true,
					)
				),
			);

			$filtered_content = wp_kses( $icon_content, $allowed_tags, array( 'http', 'https' ) );

			if ( ! preg_match( '/<svg\b/i', $filtered_content ) ) {
				return '';
			}

			return $filtered_content;
		}

		/**
		 * Retrieves the content of a registered icon.
		 *
		 * @param string $icon_name Icon name including namespace.
		 * @return string|null The content of the icon, if found.
		 */
		private function get_content( $icon_name ) {
			if ( ! isset( $this->registered_icons[ $icon_name ]['content'] ) ) {
				$content = file_get_contents(
					$this->registered_icons[ $icon_name ]['filePath']
				);
				$content = $this->sanitize_icon_content( $content );

				if ( empty( $content ) ) {
					wp_trigger_error(
						__METHOD__,
						__( 'Icon content does not contain valid SVG markup.', 'gutenberg' )
					);
					return null;
				}

				$this->registered_icons[ $icon_name ]['content'] = $content;
			}
			return $this->registered_icons[ $icon_name ]['content'];
		}

		/**
		 * Retrieves an array containing the properties of a registered icon.
		 *
		 *
		 * @param string $icon_name Icon name including namespace.
		 * @return array|null Registered icon properties or `null` if the icon is not registered.
		 */
		public function get_registered_icon( $icon_name ) {
			if ( ! $this->is_registered( $icon_name ) ) {
				return null;
			}

			$icon            = $this->registered_icons[ $icon_name ];
			$icon['content'] = $icon['content'] ?? $this->get_content( $icon_name );

			return $icon;
		}

		/**
		 * Retrieves all registered icons.
		 *
		 * @param string $search Optional. Search term by which to filter the icons.
		 * @return array[] Array of arrays containing the registered icon properties.
		 */
		public function get_registered_icons( $search = '' ) {
			$icons = array();

			foreach ( $this->registered_icons as $icon ) {
				if ( ! empty( $search ) && false === stripos( $icon['name'], $search ) ) {
					continue;
				}

				$icon['content'] = $icon['content'] ?? $this->get_content( $icon['name'] );
				$icons[]         = $icon;
			}

			return $icons;
		}

		/**
		 * Checks if an icon is registered.
		 *
		 *
		 * @param string $icon_name Icon name including namespace.
		 * @return bool True if the icon is registered, false otherwise.
		 */
		public function is_registered( $icon_name ) {
			return isset( $this->registered_icons[ $icon_name ] );
		}

		/**
		 * Utility method to retrieve the main instance of the class.
		 *
		 * The instance will be created if it does not exist yet.
		 *
		 *
		 * @return WP_Icons_Registry The main instance.
		 */
		public static function get_instance() {
			if ( null === self::$instance ) {
				self::$instance = new self();
			}

			return self::$instance;
		}
	}
}
