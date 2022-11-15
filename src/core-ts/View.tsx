import vtkInteractorStyle from '@kitware/vtk.js/Interaction/Style/InteractorStyle';
import { ICameraInitialValues } from '@kitware/vtk.js/Rendering/Core/Camera';
import { Bounds, Nullable, Vector3 } from '@kitware/vtk.js/types';
import {
  CSSProperties,
  forwardRef,
  PropsWithChildren,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IView } from '../types';
import { useOrderedUnmountContext } from '../utils-ts/useOrderedUnmountEffect';
import { ViewContext } from './contexts';
import useCamera from './modules/useCamera';
import useInteractor from './modules/useInteractor';
import {
  ManipulatorSettings,
  useInteractorStyle,
  useInteractorStyleManipulatorSettings,
} from './modules/useInteractorStyle';
import useRenderer from './modules/useRenderer';
import useRenderWindow from './modules/useRenderWindow';
import useRenderWindowView from './modules/useRenderWindowView';
import { useViewResize } from './modules/useViewResize';

const RENDERER_STYLE: CSSProperties = {
  position: 'absolute',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

interface Props extends PropsWithChildren {
  /**
   * The ID used to identify this component.
   */
  id?: string;

  /**
   * Allow user to override the default View style { width: '100%', height: '100%' }
   */
  style?: CSSProperties;

  /**
   * Allow user to provide custom className associated to root element
   */
  className?: string;

  /**
   * The color of the view background using 3 floating numbers
   * between 0-1 of Red, Green, Blue component.
   */
  background?: Vector3;

  /**
   * Configure the interactions
   * TODO fix
   */
  interactorSettings?: ManipulatorSettings[];

  /**
   * Enable/Disable interaction
   */
  interactive?: boolean;

  /**
   * Camera properties, such as position, focal point, etc.
   */
  camera?: ICameraInitialValues;

  /**
   * Whether to automatically call resetCamera() (default: true)
   *
   * When set to true, resetCamera() will be invoked whenever
   * a render is requested due to a pipeline update, e.g. the data
   * changed or a representation property was modified.
   *
   * When set to false, the user must explicitly provide camera
   * properties. Note that the initial resetCamera() call will
   * still occur upon component mount.
   */
  autoResetCamera?: boolean;

  /**
   * Whether to automatically re-set the interactor style's center of rotation. (default: true)
   *
   * This is a convenience property for interactor styles that support setCenterOfRotation().
   */
  autoCenterOfRotation?: boolean;

  /**
   * List of picking listeners to bind. By default it is disabled (empty array).
   */
  pickingModes?: 'click' | 'hover' | 'select' | 'mouseDown' | 'mouseUp';

  /**
   * User callback function for click
   */
  onClick?: () => void;

  /**
   * User callback function for mouse down
   */
  onMouseDown?: () => void;

  /**
   * User callback function for mouse up
   */
  onMouseUp?: () => void;

  /**
   * User callback function for hover
   */
  onHover?: () => void;

  /**
   * User callback function for box select
   */
  onSelect?: () => void;

  /**
   * Defines the tolerance of the click and hover selection.
   */
  pointerSize?: number;

  /**
   * Show/Hide Cube Axes for the given representation
   */
  showCubeAxes?: boolean;

  /**
   * Configure cube Axes style by overriding the set of properties defined
   * https://github.com/Kitware/vtk-js/blob/HEAD/Sources/Rendering/Core/CubeAxesActor/index.js#L703-L719
   */
  cubeAxesStyle?: Record<string, unknown>;

  /**
   * Show/Hide orientation axes.
   */
  showOrientationAxes?: boolean;
}

const DefaultProps = {
  interactive: true,
  autoResetCamera: true,
  autoCenterOfRotation: true,
  background: [0.2, 0.3, 0.4] as Vector3,
  style: {
    width: '100%',
    height: '100%',
  } as CSSProperties,
  interactorSettings: [
    {
      button: 1,
      action: 'Rotate',
    },
    {
      button: 2,
      action: 'Pan',
    },
    {
      button: 3,
      action: 'Zoom',
      scrollEnabled: true,
    },
    {
      button: 1,
      action: 'Pan',
      alt: true,
    },
    {
      button: 1,
      action: 'Zoom',
      control: true,
    },
    {
      button: 1,
      action: 'Select',
      shift: true,
    },
    {
      button: 1,
      action: 'Roll',
      alt: true,
      shift: true,
    },
  ] as ManipulatorSettings[],
};

export default forwardRef(function View(props: Props, fwdRef) {
  const OrderedUnmountContext = useOrderedUnmountContext();

  const {
    background = DefaultProps.background,
    interactive = DefaultProps.interactive,
    autoResetCamera = DefaultProps.autoResetCamera,
    autoCenterOfRotation = DefaultProps.autoCenterOfRotation,
    interactorSettings = DefaultProps.interactorSettings,
    camera: cameraProps,
  } = props;

  const containerRef = useRef<Nullable<HTMLDivElement>>(null);

  const getRWView = useRenderWindowView(containerRef.current);
  const getRenderer = useRenderer(background);
  // We need to attach the renderWindowView to the renderWindow
  // before setting the view onto the interactor.
  const getRenderWindow = useRenderWindow(getRWView, getRenderer);
  const getInteractor = useInteractor(
    getRWView,
    containerRef.current,
    interactive
  );

  const [getInteractorStyle, setInteractorStyle] =
    useInteractorStyle(getInteractor);
  useInteractorStyleManipulatorSettings(getInteractorStyle, interactorSettings);

  // --- rendering state --- //

  const [renderRequested, setRenderRequested] = useState(false);
  const requestRender = () => setRenderRequested(true);

  // --- camera --- //

  const getCamera = useCamera(getRenderer, requestRender, cameraProps);

  const resetCamera = useCallback(
    (boundsToUse?: Bounds) => {
      getRenderer().resetCamera(boundsToUse);
      if (
        autoCenterOfRotation &&
        'setCenterOfRotation' in getInteractorStyle()
      ) {
        const style = getInteractorStyle() as vtkInteractorStyle & {
          setCenterOfRotation(center: Vector3): boolean;
        };
        style.setCenterOfRotation(getCamera().getFocalPoint());
      }
    },
    [autoCenterOfRotation, getRenderer, getInteractorStyle, getCamera]
  );

  // --- handle renders --- //

  useEffect(() => {
    if (renderRequested) {
      if (autoResetCamera) {
        resetCamera();
      }
      getRenderWindow().render();
      setRenderRequested(false);
    }
  }, [renderRequested, autoResetCamera, resetCamera, getRenderWindow]);

  // --- view API --- //

  const view = useMemo<IView>(() => {
    return {
      getRenderer,
      getRenderWindow,
      getInteractor,
      getAPISpecificRenderWindow: getRWView,
      getCamera,
      getInteractorStyle,
      setInteractorStyle,
      /**
       * Requests a vtk.js render.
       *
        This will batch render requests, triggering a single
       * vtk.js render once after a react render.
       */
      requestRender,
      /**
       * Resets the camera.
       */
      resetCamera: (boundsToUse?: Bounds) => {
        resetCamera(boundsToUse);
        requestRender();
      },
    };
  }, [
    getRWView,
    getRenderer,
    getRenderWindow,
    getInteractor,
    getCamera,
    getInteractorStyle,
    setInteractorStyle,
    resetCamera,
  ]);

  // expose the view as a ref for imperative control
  useImperativeHandle(fwdRef, () => view);

  // handle resizing
  useViewResize(containerRef, view);

  const { style = DefaultProps.style } = props;
  const containerStyle = useMemo<CSSProperties>(
    () => ({
      position: 'relative',
      ...style,
    }),
    [style]
  );

  return (
    <OrderedUnmountContext.Provider>
      <ViewContext.Provider value={view}>
        <div style={containerStyle}>
          <div ref={containerRef} style={RENDERER_STYLE} />
          {props.children}
        </div>
      </ViewContext.Provider>
    </OrderedUnmountContext.Provider>
  );
});
