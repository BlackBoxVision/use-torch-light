# UseTorchLight [![npm version](https://badge.fury.io/js/%40blackbox-vision%2Fuse-torch-light.svg)](https://badge.fury.io/js/%40blackbox-vision%2Fuse-torch-light) [![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT) [![Known Vulnerabilities](https://snyk.io/test/github/blackboxvision/use-torch-light/badge.svg)](https://snyk.io/test/github/blackboxvision/use-torch-light)

🔦 **useTorchLight** is a hook to enable/disable camera flash. Check out the [demo](https://zittu.csb.app).

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
import React, { useState, useRef } from 'react';
import { QrReader } from '@blackbox-vision/react-qr-reader';
import { useTorchLight } from '@blackbox-vision/use-torch-light';

const Test = (props) => {
  const streamRef = useRef(null);

  const [error, setError] = useState(null);
  const [data, setData] = useState('No result');

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
        style={{ width: '100%' }}
      />
      <button onClick={toggle}>{on ? 'Disable Torch' : 'Enable Torch'}</button>
      <p>{JSON.stringify(data, null, 2)}</p>
      <p>{JSON.stringify(error, null, 2)}</p>
    </>
  );
};
```

## Issues

Please, open an [issue](https://github.com/BlackBoxVision/use-torch-light/issues) following one of the issues templates. We will do our best to fix them.

## Contributing

If you want to contribute to this project see [contributing](https://github.com/BlackBoxVision/use-torch-light/blob/master/CONTRIBUTING.md) for more information.

## License

Distributed under the **MIT license**. See [LICENSE](https://github.com/BlackBoxVision/use-torch-light/blob/master/LICENSE) for more information.
