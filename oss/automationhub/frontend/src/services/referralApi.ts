import { useQuery } from 'react-query';
import api from './api';

export interface ReferralInfo {
  invite_link: string;
  referral_code: string;
}

export const fetchMyReferral = async (): Promise<ReferralInfo> => {
  const { data } = await api.get<ReferralInfo>('/users/me/referral');
  return data;
};

export const useMyReferral = () => {
  return useQuery('myReferral', fetchMyReferral, { staleTime: 60000 });
};
