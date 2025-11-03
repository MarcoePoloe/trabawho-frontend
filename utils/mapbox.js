import mbxGeocoding from "@mapbox/mapbox-sdk/services/geocoding";
import { MAPBOX_TOKEN } from '../components/mapboxToken';

const mapboxClient = mbxGeocoding({
  accessToken: MAPBOX_TOKEN
});

export default mapboxClient;