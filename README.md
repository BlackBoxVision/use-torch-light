# UseTorchLight [![npm version](https://badge.fury.io/js/%40blackbox-vision%2Fuse-torch-light.svg)](https://badge.fury.io/js/%40blackbox-vision%2Fuse-torch-light) [![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT) [![Known Vulnerabilities](https://snyk.io/test/github/blackboxvision/use-torch-light/badge.svg)](https://snyk.io/test/github/blackboxvision/use-torch-light)

:rocket: useTorchLight is a hook to enable/disable camera flash.

## Install

You can install this library via NPM or YARN.

### NPM

```bash
npm i @blackbox-vision/use-torch-light
```

### YARN

```bash
yarn add @blackbox-vision/use-torch-light
```

## Usage

The usage is really simple:

```javascript
import React, { useState, useRef } from "react";
import { QrReader } from "@blackbox-vision/react-qr-reader";
import { useTorchLight } from "@blackbox-vision/use-torch-light";

const Test = props => {
  const streamRef = useRef(null);

  const [error, setError] = useState(null);
  const [data, setData] = useState("No result");
  
  const [on, toggle] = useTorchLight(streamRef.current);

  const setRef = ({ stream }) => {
    streamRef.current = stream;
  };

  return (
    <>
      <QrReader
        onLoad={setRef}
        onScan={setData}
        onError={setError}
        style={{ width: "100%" }}
      />
      <button onClick={toggle}>{on ? "Disable Torch" : "Enable Torch"}</button>
      <p>{JSON.stringify(data, null, 2)}</p>
      <p>{JSON.stringify(error, null, 2)}</p>
    </>
  );
};
```

## Props

### Events

| Prop    | Argument | Description                                                                                                                                             |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| onScan  | `result` | Scan event handler. Called every scan with the decoded value or `null` if no QR code was found.                                                         |
| onError | `Error`  | Called when an error occurs.                                                                                                                            |
| onLoad  | `object` | Called when the component is ready for use. Object properties are `stream`: [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) |

### Options

| Prop           | Type                    | Default       | Description                                                                                                                                                       |
| -------------- | ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| facingMode     | `user` or `environment` | `environment` | Specify which camera should be used (if available).                                                                                                               |
| resolution     | number                  | `600`         | The resolution of the video (or image in legacyMode). Larger resolution will increase the accuracy but it will also slow down the processing time.                |
| style          | a valid React style     | none          | Styling for the container element. **Warning** The preview will always keep its 1:1 aspect ratio.                                                                 |
| className      | string                  | none          | ClassName for the container element.                                                                                                                              |
| showViewFinder | boolean                 | `true`        | Show or hide the build in view finder. See demo                                                                                                                   |
| constraints    | object                  | `null`        | Use custom camera constraints that the override default behavior. [MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints) |
| debug          | boolean                 | `null`        | Enable debug logs to see what's going on inside the component                                                                                                     |

## Tested platforms

- Chrome Mac OS & Android
- Firefox Mac OS & Android
- Safari Mac OS & IOS

## Issues

Please, open an [issue](https://github.com/BlackBoxVision/use-torch-light/issues) following one of the issues templates. We will do our best to fix them.

## Contributing

If you want to contribute to this project see [contributing](https://github.com/BlackBoxVision/use-torch-light/blob/master/CONTRIBUTING.md) for more information.

## License

Distributed under the **MIT license**. See [LICENSE](https://github.com/BlackBoxVision/use-torch-light/blob/master/LICENSE) for more information.
