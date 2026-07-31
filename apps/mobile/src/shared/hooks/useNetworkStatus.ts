import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** True once the device has real internet reachability, not just a network interface. */
export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsConnected(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  }, []);

  return isConnected;
}
