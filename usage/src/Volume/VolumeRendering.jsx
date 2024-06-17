import vtkXMLImageDataReader from '@kitware/vtk.js/IO/XML/XMLImageDataReader';
import { useRef } from 'react';
import {
  Reader,
  View,
  VolumeController,
  VolumeRepresentation,
} from 'react-vtk-js';

function Example() {
  const view = useRef();
  const run = () => {
    const v = view.current;
    const camera = v.getCamera();
    camera.azimuth(0.5);
    v.requestRender();
    requestAnimationFrame(run);
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <button onClick={run}>Rotate</button>
      <View id='0' ref={view}>
        <VolumeRepresentation>
          <VolumeController />
          <Reader
            vtkClass={vtkXMLImageDataReader}
            url='https://data.kitware.com/api/v1/item/59e12e988d777f31ac6455c5/download'
          />
        </VolumeRepresentation>
      </View>
    </div>
  );
}

export default Example;
