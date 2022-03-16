import { EPINIO_TYPES } from '@/products/epinio/types';

import { MANAGEMENT } from '@/config/types';
import { base64Decode } from '@/utils/crypto';
import { ingressFullPath } from '@/models/networking.k8s.io.ingress';
import { allHash } from '@/utils/promise';

export default {
  async discover(store) {
    const allClusters = await store.dispatch('management/findAll', { type: MANAGEMENT.CLUSTER }, { root: true });
    const epinioClusters = [];

    for (const c of allClusters.filter(c => c.isReady)) {
      try {
        // Get the url first, if it has this it's highly likely it's an epinio cluster
        const epinioIngress = await store.dispatch(`cluster/request`, { url: `/k8s/clusters/${ c.id }/v1/networking.k8s.io.ingresses/epinio/epinio` }, { root: true });
        const url = ingressFullPath(epinioIngress, epinioIngress.spec.rules?.[0]);

        const epinio = await allHash({
          authData:   store.dispatch(`cluster/request`, { url: `/k8s/clusters/${ c.id }/v1/secrets/epinio/default-epinio-user` }, { root: true }),
          info:       store.dispatch(`cluster/request`, { url: `${ url }/api/v1/info` }, { root: true }),
        });

        const username = epinio.authData.data.username;
        const password = epinio.authData.data.password;

        epinioClusters.push({
          id:          c.id,
          name:        c.spec.displayName,
          api:         url,
          version:     epinio.info.version,
          readyApi:    `${ url }/ready`,
          username:    base64Decode(username),
          password:    base64Decode(password),
          type:        EPINIO_TYPES.INSTANCE,
          mgmtCluster: c
        });
      } catch (err) {
        console.info(`Skipping epinio discovery for ${ c.spec.displayName }`, err); // eslint-disable-line no-console
      }
    }

    return epinioClusters;
  }
};