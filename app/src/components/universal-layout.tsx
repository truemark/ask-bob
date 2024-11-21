import type {JSX} from '@builder.io/qwik';
import {Slot, component$} from '@builder.io/qwik';

interface UniversalLayoutProps {
  class?: string;
  outerLeft?: JSX.Element;
  outerLeftClass?: string;
  outerRight?: JSX.Element;
  outerRightClass?: string;
  top?: JSX.Element;
  topClass?: string;
  left?: JSX.Element;
  leftClass?: string;
  right?: JSX.Element;
  rightClass?: string;
  bottom?: JSX.Element;
  bottomClass?: string;
  innerTop?: JSX.Element;
  innerTopClass?: string;
  innerBottom?: JSX.Element;
  innerBottomClass?: string;
  childrenClass?: string;
}

export default component$<UniversalLayoutProps>((props) => {
  // Augment props
  const aprops = {
    ...props,
    class: `flex min-h-screen${props.class ? ` ${props.class}` : ''}`,
    outerLeftClass: `${props.outerLeftClass ? `${props.outerLeftClass}` : ''}`,
    topClass: `${props.topClass ?? ''}`,
    leftClass: `${props.leftClass ?? ''}`,
    childrenClass: `flex-grow${props.childrenClass ? ` ${props.childrenClass}` : ''}`,
    innerTopClass: `${props.innerTopClass ?? ''}`,
    innerBottomClass: `${props.innerBottomClass ?? ''}`,
    rightClass: `${props.rightClass ?? ''}`,
    bottomClass: `${props.bottomClass ?? ''}`,
    outerRightClass: `${props.outerRightClass ?? ''}`,
  };

  return (
    <div id="universal" class={aprops.class}>
      <div id="universal-outer-left" class={aprops.outerLeftClass}>
        {aprops.outerLeft}
      </div>
      <div class="flex flex-grow flex-col">
        <div id="universal-top" class={aprops.topClass}>
          {aprops.top}
        </div>
        <div class="flex flex-grow">
          <div id="universal-left" class={aprops.leftClass}>
            {aprops.left}
          </div>
          <div class="flex w-full flex-col">
            <div id="universal-right" class={aprops.innerTopClass}>
              {aprops.innerTop}
            </div>
            <div class={aprops.childrenClass}>
              <Slot />
            </div>
            <div id="universal-right" class={aprops.innerBottomClass}>
              {aprops.innerBottom}
            </div>
          </div>
          <div id="universal-right" class={aprops.rightClass}>
            {aprops.right}
          </div>
        </div>
        <div id="universal-bottom" class={aprops.bottomClass}>
          {aprops.bottom}
        </div>
      </div>
      <div id="universal-outer-right" class={aprops.outerRightClass}>
        {aprops.outerRight}
      </div>
    </div>
  );
});
