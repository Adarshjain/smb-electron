import { useState } from 'react';

export default function EntriesByHead({ headName }: { headName: string }) {
  const [internalHeadName, setInternalHeadName] = useState(headName);
}
