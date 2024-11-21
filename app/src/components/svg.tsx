import {component$, Slot} from '@builder.io/qwik';

export interface BaseProps {
  'viewBox': string;
  'stroke-width'?: string;
  /**
   * Specifies the width and height when they are equal.
   */
  'size'?: number | string;
  /**
   * Specifies the width of the image.
   */
  'width'?: number | string;
  /**
   * Specifies the height of the image.
   */
  'height'?: number | string;
  'version'?: string;
  'id'?: string;
  'xmlns:xlink'?: string;
  'xml:space'?: string;
  'x'?: string;
  'y'?: string;
}

export type IconProps = Omit<BaseProps, 'viewBox' | 'stroke-width'>;

export default component$((props: BaseProps) => {
  const {size, width, height, ...rest} = props;
  const svgProps: Record<string, string | number> = {};
  if (size) {
    svgProps['width'] = size;
    svgProps['height'] = size;
  }
  if (width) {
    svgProps['width'] = width;
  }
  if (height) {
    svgProps['height'] = height;
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" {...rest} {...svgProps}>
      <Slot />
    </svg>
  );
});
