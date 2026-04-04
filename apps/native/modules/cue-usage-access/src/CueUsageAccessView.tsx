import { requireNativeView } from 'expo';
import * as React from 'react';

import { CueUsageAccessViewProps } from './CueUsageAccess.types';

const NativeView: React.ComponentType<CueUsageAccessViewProps> =
  requireNativeView('CueUsageAccess');

export default function CueUsageAccessView(props: CueUsageAccessViewProps) {
  return <NativeView {...props} />;
}
