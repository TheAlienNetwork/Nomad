export type UsStateCode =
  | "AL"
  | "AK"
  | "AZ"
  | "AR"
  | "CA"
  | "CO"
  | "CT"
  | "DE"
  | "FL"
  | "GA"
  | "HI"
  | "ID"
  | "IL"
  | "IN"
  | "IA"
  | "KS"
  | "KY"
  | "LA"
  | "ME"
  | "MD"
  | "MA"
  | "MI"
  | "MN"
  | "MS"
  | "MO"
  | "MT"
  | "NE"
  | "NV"
  | "NH"
  | "NJ"
  | "NM"
  | "NY"
  | "NC"
  | "ND"
  | "OH"
  | "OK"
  | "OR"
  | "PA"
  | "RI"
  | "SC"
  | "SD"
  | "TN"
  | "TX"
  | "UT"
  | "VT"
  | "VA"
  | "WA"
  | "WV"
  | "WI"
  | "WY";

export type StateHuntGuide = {
  code: UsStateCode;
  name: string;
  agency: string;
  huntingUrl: string;
};

export const STATE_HUNT_GUIDES: StateHuntGuide[] = [
  { code: "AL", name: "Alabama", agency: "Alabama Department of Conservation and Natural Resources", huntingUrl: "https://www.outdooralabama.com/hunting" },
  { code: "AK", name: "Alaska", agency: "Alaska Department of Fish and Game", huntingUrl: "https://www.adfg.alaska.gov/index.cfm?adfg=hunting.main" },
  { code: "AZ", name: "Arizona", agency: "Arizona Game and Fish Department", huntingUrl: "https://www.azgfd.com/hunting/" },
  { code: "AR", name: "Arkansas", agency: "Arkansas Game and Fish Commission", huntingUrl: "https://www.agfc.com/hunting/" },
  { code: "CA", name: "California", agency: "California Department of Fish and Wildlife", huntingUrl: "https://wildlife.ca.gov/Hunting" },
  { code: "CO", name: "Colorado", agency: "Colorado Parks and Wildlife", huntingUrl: "https://cpw.state.co.us/hunting" },
  { code: "CT", name: "Connecticut", agency: "Connecticut Department of Energy and Environmental Protection", huntingUrl: "https://portal.ct.gov/deep/hunting" },
  { code: "DE", name: "Delaware", agency: "Delaware Division of Fish and Wildlife", huntingUrl: "https://dnrec.delaware.gov/fish-wildlife/hunting/" },
  { code: "FL", name: "Florida", agency: "Florida Fish and Wildlife Conservation Commission", huntingUrl: "https://myfwc.com/hunting/" },
  { code: "GA", name: "Georgia", agency: "Georgia Department of Natural Resources", huntingUrl: "https://georgiawildlife.com/hunting" },
  { code: "HI", name: "Hawaii", agency: "Hawaii Division of Forestry and Wildlife", huntingUrl: "https://dlnr.hawaii.gov/recreation/hunting/" },
  { code: "ID", name: "Idaho", agency: "Idaho Department of Fish and Game", huntingUrl: "https://idfg.idaho.gov/hunt" },
  { code: "IL", name: "Illinois", agency: "Illinois Department of Natural Resources", huntingUrl: "https://dnr.illinois.gov/hunting.html" },
  { code: "IN", name: "Indiana", agency: "Indiana Department of Natural Resources", huntingUrl: "https://www.in.gov/dnr/fish-and-wildlife/hunting-and-trapping/" },
  { code: "IA", name: "Iowa", agency: "Iowa Department of Natural Resources", huntingUrl: "https://www.iowadnr.gov/hunting" },
  { code: "KS", name: "Kansas", agency: "Kansas Department of Wildlife and Parks", huntingUrl: "https://ksoutdoors.com/Hunting" },
  { code: "KY", name: "Kentucky", agency: "Kentucky Department of Fish and Wildlife Resources", huntingUrl: "https://fw.ky.gov/Hunt/Pages/default.aspx" },
  { code: "LA", name: "Louisiana", agency: "Louisiana Department of Wildlife and Fisheries", huntingUrl: "https://www.wlf.louisiana.gov/page/hunting" },
  { code: "ME", name: "Maine", agency: "Maine Department of Inland Fisheries and Wildlife", huntingUrl: "https://www.maine.gov/ifw/hunting-trapping/index.html" },
  { code: "MD", name: "Maryland", agency: "Maryland Department of Natural Resources", huntingUrl: "https://dnr.maryland.gov/wildlife/Pages/hunt_trap/index.aspx" },
  { code: "MA", name: "Massachusetts", agency: "Massachusetts Division of Fisheries and Wildlife", huntingUrl: "https://www.mass.gov/hunting" },
  { code: "MI", name: "Michigan", agency: "Michigan Department of Natural Resources", huntingUrl: "https://www.michigan.gov/dnr/things-to-do/hunting" },
  { code: "MN", name: "Minnesota", agency: "Minnesota Department of Natural Resources", huntingUrl: "https://www.dnr.state.mn.us/hunting/index.html" },
  { code: "MS", name: "Mississippi", agency: "Mississippi Department of Wildlife, Fisheries, and Parks", huntingUrl: "https://www.mdwfp.com/wildlife-hunting" },
  { code: "MO", name: "Missouri", agency: "Missouri Department of Conservation", huntingUrl: "https://mdc.mo.gov/hunting-trapping" },
  { code: "MT", name: "Montana", agency: "Montana Fish, Wildlife & Parks", huntingUrl: "https://fwp.mt.gov/hunt" },
  { code: "NE", name: "Nebraska", agency: "Nebraska Game and Parks Commission", huntingUrl: "https://outdoornebraska.gov/hunt/" },
  { code: "NV", name: "Nevada", agency: "Nevada Department of Wildlife", huntingUrl: "https://www.ndow.org/hunt/" },
  { code: "NH", name: "New Hampshire", agency: "New Hampshire Fish and Game Department", huntingUrl: "https://www.wildlife.nh.gov/hunting-nh" },
  { code: "NJ", name: "New Jersey", agency: "New Jersey Division of Fish and Wildlife", huntingUrl: "https://dep.nj.gov/njfw/hunting/" },
  { code: "NM", name: "New Mexico", agency: "New Mexico Department of Game and Fish", huntingUrl: "https://www.wildlife.state.nm.us/hunting/" },
  { code: "NY", name: "New York", agency: "New York State Department of Environmental Conservation", huntingUrl: "https://dec.ny.gov/things-to-do/hunting" },
  { code: "NC", name: "North Carolina", agency: "North Carolina Wildlife Resources Commission", huntingUrl: "https://www.ncwildlife.org/hunting" },
  { code: "ND", name: "North Dakota", agency: "North Dakota Game and Fish Department", huntingUrl: "https://gf.nd.gov/hunting" },
  { code: "OH", name: "Ohio", agency: "Ohio Department of Natural Resources", huntingUrl: "https://ohiodnr.gov/discover-and-learn/safety-conservation/hunting" },
  { code: "OK", name: "Oklahoma", agency: "Oklahoma Department of Wildlife Conservation", huntingUrl: "https://www.wildlifedepartment.com/hunting" },
  { code: "OR", name: "Oregon", agency: "Oregon Department of Fish and Wildlife", huntingUrl: "https://www.dfw.state.or.us/resources/hunting/" },
  { code: "PA", name: "Pennsylvania", agency: "Pennsylvania Game Commission", huntingUrl: "https://www.pgc.pa.gov/HuntTrap/Pages/default.aspx" },
  { code: "RI", name: "Rhode Island", agency: "Rhode Island Department of Environmental Management", huntingUrl: "https://dem.ri.gov/natural-resources-bureau/fish-wildlife/hunting" },
  { code: "SC", name: "South Carolina", agency: "South Carolina Department of Natural Resources", huntingUrl: "https://www.dnr.sc.gov/hunting.html" },
  { code: "SD", name: "South Dakota", agency: "South Dakota Game, Fish and Parks", huntingUrl: "https://gfp.sd.gov/hunting/" },
  { code: "TN", name: "Tennessee", agency: "Tennessee Wildlife Resources Agency", huntingUrl: "https://www.tn.gov/twra/hunting.html" },
  { code: "TX", name: "Texas", agency: "Texas Parks and Wildlife Department", huntingUrl: "https://tpwd.texas.gov/regulations/outdoor-annual/" },
  { code: "UT", name: "Utah", agency: "Utah Division of Wildlife Resources", huntingUrl: "https://wildlife.utah.gov/hunting.html" },
  { code: "VT", name: "Vermont", agency: "Vermont Fish & Wildlife Department", huntingUrl: "https://vtfishandwildlife.com/hunt" },
  { code: "VA", name: "Virginia", agency: "Virginia Department of Wildlife Resources", huntingUrl: "https://dwr.virginia.gov/hunting/" },
  { code: "WA", name: "Washington", agency: "Washington Department of Fish and Wildlife", huntingUrl: "https://wdfw.wa.gov/hunting" },
  { code: "WV", name: "West Virginia", agency: "West Virginia Division of Natural Resources", huntingUrl: "https://wvdnr.gov/hunting/" },
  { code: "WI", name: "Wisconsin", agency: "Wisconsin Department of Natural Resources", huntingUrl: "https://dnr.wisconsin.gov/topic/hunt" },
  { code: "WY", name: "Wyoming", agency: "Wyoming Game and Fish Department", huntingUrl: "https://wgfd.wyo.gov/apply-or-buy/hunting" },
];

const byCode = new Map(STATE_HUNT_GUIDES.map((guide) => [guide.code, guide]));

export function isUsStateCode(value: string): value is UsStateCode {
  return byCode.has(value as UsStateCode);
}

export function stateHuntGuide(code: string | null | undefined): StateHuntGuide | undefined {
  if (!code) return undefined;
  return byCode.get(code as UsStateCode);
}
