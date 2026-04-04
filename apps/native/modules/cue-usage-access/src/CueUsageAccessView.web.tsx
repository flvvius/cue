import * as React from 'react';

import { CueUsageAccessViewProps } from './CueUsageAccess.types';

export default function CueUsageAccessView(props: CueUsageAccessViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
