const axios = require('axios');
const XLSX = require('xlsx');
const _ = require('lodash');

const API_TOKEN = 'Bearer YOUR_API_TOKEN'; // Replace with your token
const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Authorization': API_TOKEN,
};

// Fields from various objects
const pkgFields = ['id', 'name', 'production'];
const planFields = [
  'id', 'name', 'status', 'description', 'keyLifespan', 'rateLimitCeiling', 'rateLimitExempt',
  'rateLimitKeyOverrideAllowed', 'rateLimitPeriod', 'qpsLimitCeiling', 'qpsLimitExempt',
  'qpsLimitKeyOverrideAllowed', 'maxNumKeysAllowed', 'numKeysBeforeReview',
  'responseFilterOverrideAllowed', 'selfServiceKeyProvisioningEnabled',
  'adminKeyProvisioningEnabled', 'listed', 'production'
];
const svcFields = ['id', 'name', 'version'];
const epFields = [
  'id', 'name', 'type', 'requestProtocol', 'requestAuthenticationType',
  'customRequestAuthenticationAdapter', 'outboundTransportProtocol',
  'trafficManagerDomain', 'outboundRequestTargetPath', 'outboundRequestTargetQueryParameters',
  'requestPathAlias', 'apiMethodDetectionKey', 'apiKeyValueLocationKey',
  'highSecurity', 'httpsClientProfile'
];
const arrayFields = {
  supportedHttpMethods: ',', 
  apiMethodDetectionLocations: ',', 
  oauthGrantTypes: ',', 
  apiKeyValueLocations: ',', 
  publicDomains: 'address',   
  systemDomains: 'address'
};

// Get all packages with plans and organization info
async function fetchPackages() {
  const fields = ['id', 'name', 'plans', 'organization', 'production'].join(',');
  const url = `https://api.mashery.com/v3/rest/packages?fields=${encodeURIComponent(fields)}`;
  return (await axios.get(url, { headers })).data;
}

// Get all services under a plan
async function fetchServices(pkgId, planId) {
  const fields = svcFields.concat(['endpoints.id']).join(',');
  const url = `https://api.mashery.com/v3/rest/packages/${pkgId}/plans/${planId}/services?fields=${encodeURIComponent(fields)}`;
  return (await axios.get(url, { headers })).data;
}

// Get detailed endpoint info
async function fetchEndpointDetails(serviceId) {
  const fields = epFields.concat(Object.keys(arrayFields)).join(',');
  const url = `https://api.mashery.com/v3/rest/services/${serviceId}/endpoints?fields=${encodeURIComponent(fields)}`;
  return (await axios.get(url, { headers })).data;
}

(async () => {
  const packages = await fetchPackages();
  const allRows = [];

  for (const pkg of packages) {
    const pkgData = _.pick(pkg, pkgFields);
    pkgData.packageName = pkg.name;
    pkgData.Organization = pkg.organization?.name || 'Unknown';

    for (const plan of pkg.plans || []) {
      const planData = _.pick(plan, planFields);
      planData.planName = plan.name;

      const services = await fetchServices(pkg.id, plan.id);
      for (const svc of services) {
        const svcData = _.pick(svc, svcFields);
        const apiDefinitionName = svcData.name;

        const endpoints = await fetchEndpointDetails(svc.id);
        for (const ep of endpoints) {
          const epData = _.pick(ep, epFields);

          // Flatten array fields
          for (const [field, subKey] of Object.entries(arrayFields)) {
            let values = _.get(ep, field, []);
            if (Array.isArray(values)) {
              values = values.map(v => typeof v === 'object' ? v[subKey] || '' : v);
              epData[field] = values.join(', ');
            } else {
              epData[field] = '';
            }
          }

          // Final row
          const row = {
            APIDefinitionName: apiDefinitionName,
            EndpointName: ep.name,
            ...pkgData,
            ...planData,
            ...svcData,
            ...epData
          };

          allRows.push(row);
        }
      }
    }
  }

  // Export to XLSX
  const ws = XLSX.utils.json_to_sheet(allRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mashery API Export');
  XLSX.writeFile(wb, 'Mashery_API_Export_With_Definition_First.xlsx');

  console.log('✅ Export complete: Mashery_API_Export_With_Definition_First.xlsx');
})();
