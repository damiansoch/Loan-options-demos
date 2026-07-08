import { useState, useEffect } from "react";

export function useManifest() {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/manifest.json")
      .then((res) => res.json())
      .then(setManifest)
      .finally(() => setLoading(false));
  }, []);

  return { manifest, loading };
}
