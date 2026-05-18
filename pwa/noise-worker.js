/**
 * EIRENE noise-worker.js
 * Web Worker — generates cover traffic
 * Runs independently of real traffic
 * Goes DIRECT to internet — NOT through tunnel
 * Poisson-distributed timing. Human-like.
 * Real URLs — actual articles, scores, weather, reference pages.
 *
 * Cloud SNS Pty Ltd
 */

// ── URL List — ~500 real Australian browsing URLs ────────────────────────────
// Weighted by category to match FIFO worker browsing patterns.
// These are real pages a real person actually visits.

const NOISE_URLS = [

  // ── NEWS — abc.net.au (25%) ───────────────────────────────────────────────
  'https://www.abc.net.au/',
  'https://www.abc.net.au/news/',
  'https://www.abc.net.au/news/australia/',
  'https://www.abc.net.au/news/western-australia/',
  'https://www.abc.net.au/news/queensland/',
  'https://www.abc.net.au/news/science/',
  'https://www.abc.net.au/news/politics/',
  'https://www.abc.net.au/news/business/',
  'https://www.abc.net.au/news/environment/',
  'https://www.abc.net.au/news/health/',
  'https://www.abc.net.au/news/technology/',
  'https://www.abc.net.au/news/world/',
  'https://www.abc.net.au/news/rural/',
  'https://www.abc.net.au/news/indigenous/',
  'https://www.abc.net.au/news/community/',

  // SMH
  'https://www.smh.com.au/',
  'https://www.smh.com.au/national/',
  'https://www.smh.com.au/politics/',
  'https://www.smh.com.au/business/',
  'https://www.smh.com.au/technology/',
  'https://www.smh.com.au/environment/',
  'https://www.smh.com.au/world/',
  'https://www.smh.com.au/lifestyle/',

  // The Guardian Australia
  'https://www.theguardian.com/australia-news',
  'https://www.theguardian.com/australia-news/western-australia',
  'https://www.theguardian.com/australia-news/queensland',
  'https://www.theguardian.com/world/australia',
  'https://www.theguardian.com/environment/australia',
  'https://www.theguardian.com/society/australia',

  // The Age
  'https://www.theage.com.au/',
  'https://www.theage.com.au/national/',
  'https://www.theage.com.au/politics/',
  'https://www.theage.com.au/business/',

  // Herald Sun
  'https://www.heraldsun.com.au/',
  'https://www.heraldsun.com.au/news/',
  'https://www.heraldsun.com.au/news/victoria/',

  // Courier Mail
  'https://www.couriermail.com.au/',
  'https://www.couriermail.com.au/news/queensland/',

  // West Australian
  'https://thewest.com.au/',
  'https://thewest.com.au/news/wa/',
  'https://thewest.com.au/news/mining/',

  // NT News
  'https://www.ntnews.com.au/',

  // BBC (Australians read it)
  'https://www.bbc.com/news/',
  'https://www.bbc.com/news/world/australia',
  'https://www.bbc.com/news/science-environment',
  'https://www.bbc.com/news/technology',
  'https://www.bbc.com/news/business',
  'https://www.bbc.com/news/world',
  'https://www.bbc.com/news/health',

  // Reuters
  'https://www.reuters.com/',
  'https://www.reuters.com/world/',
  'https://www.reuters.com/business/',
  'https://www.reuters.com/technology/',

  // Nine/MSN news
  'https://www.9news.com.au/',
  'https://www.9news.com.au/national/',
  'https://www.9news.com.au/world/',

  // SBS
  'https://www.sbs.com.au/news/',
  'https://www.sbs.com.au/news/australia/',
  'https://www.sbs.com.au/news/world/',

  // ── WEATHER (15%) ─────────────────────────────────────────────────────────
  'https://www.bom.gov.au/',
  'https://www.bom.gov.au/wa/',
  'https://www.bom.gov.au/qld/',
  'https://www.bom.gov.au/nt/',
  'https://www.bom.gov.au/nsw/',
  'https://www.bom.gov.au/sa/',
  'https://www.bom.gov.au/products/IDW60801.shtml',  // Perth observations
  'https://www.bom.gov.au/products/IDQ60801.shtml',  // Brisbane observations
  'https://www.bom.gov.au/products/IDD60801.shtml',  // Darwin observations
  'https://www.bom.gov.au/marine/',
  'https://www.bom.gov.au/marine/wa.shtml',
  'https://www.bom.gov.au/cyclone/',
  'https://www.bom.gov.au/australia/radar/',
  'https://www.bom.gov.au/australia/satellite/',
  'https://www.bom.gov.au/climate/',
  'https://www.bom.gov.au/water/',
  'https://www.bom.gov.au/climate/dwo/',
  'https://www.weatherzone.com.au/',
  'https://www.weatherzone.com.au/wa/perth/',
  'https://www.weatherzone.com.au/qld/brisbane/',
  'https://www.weatherzone.com.au/nt/darwin/',
  'https://www.windy.com/',

  // ── SPORT — AFL (15%) ─────────────────────────────────────────────────────
  'https://www.afl.com.au/',
  'https://www.afl.com.au/matches/',
  'https://www.afl.com.au/ladder/',
  'https://www.afl.com.au/stats/',
  'https://www.afl.com.au/news/',
  'https://www.afl.com.au/clubs/westcoasteagles/',
  'https://www.afl.com.au/clubs/fremantledockers/',
  'https://www.afl.com.au/clubs/brisbanelions/',
  'https://www.afl.com.au/clubs/goldcoastsuns/',
  'https://www.afl.com.au/clubs/richmondtigers/',
  'https://www.afl.com.au/clubs/collingwoodmagpies/',
  'https://www.afl.com.au/clubs/carltonblues/',
  'https://www.afl.com.au/clubs/essendonbombers/',
  'https://www.afl.com.au/clubs/geelongcats/',
  'https://www.afl.com.au/clubs/hawthornahawks/',
  'https://www.afl.com.au/clubs/melbournedemons/',
  'https://www.afl.com.au/clubs/northmelbournekangaroos/',
  'https://www.afl.com.au/clubs/portadelaidepowercrowd/',
  'https://www.afl.com.au/clubs/adelaidecrows/',
  'https://www.afl.com.au/clubs/stkildafc/',
  'https://www.afl.com.au/clubs/sydneyswans/',
  'https://www.afl.com.au/clubs/greaterwesterngiants/',

  // NRL
  'https://www.nrl.com/',
  'https://www.nrl.com/ladder/',
  'https://www.nrl.com/draw/',
  'https://www.nrl.com/news/',
  'https://www.nrl.com/teams/broncos/',
  'https://www.nrl.com/teams/cowboys/',
  'https://www.nrl.com/teams/storm/',
  'https://www.nrl.com/teams/roosters/',
  'https://www.nrl.com/teams/sharks/',
  'https://www.nrl.com/teams/raiders/',

  // Fox Sports
  'https://www.foxsports.com.au/',
  'https://www.foxsports.com.au/afl/',
  'https://www.foxsports.com.au/nrl/',
  'https://www.foxsports.com.au/cricket/',
  'https://www.foxsports.com.au/football/',
  'https://www.foxsports.com.au/tennis/',
  'https://www.foxsports.com.au/motorsport/',

  // Cricket
  'https://www.cricket.com.au/',
  'https://www.cricket.com.au/news/',
  'https://www.cricket.com.au/teams/australia/',
  'https://www.espncricinfo.com/',
  'https://www.espncricinfo.com/series/',

  // Football (Soccer)
  'https://www.footballaustralia.com.au/',
  'https://www.a-league.com.au/',
  'https://www.a-league.com.au/ladder/',
  'https://www.a-league.com.au/fixtures/',

  // Tennis
  'https://www.tennis.com.au/',
  'https://www.ausopen.com/',

  // Motor Sport
  'https://www.supercars.com/',
  'https://www.supercars.com/results/',
  'https://www.motorsport.com/f1/',

  // ── REFERENCE — Wikipedia (20%) ───────────────────────────────────────────
  'https://en.wikipedia.org/wiki/Main_Page',
  'https://en.wikipedia.org/wiki/Australia',
  'https://en.wikipedia.org/wiki/Western_Australia',
  'https://en.wikipedia.org/wiki/Queensland',
  'https://en.wikipedia.org/wiki/Northern_Territory',
  'https://en.wikipedia.org/wiki/Pilbara',
  'https://en.wikipedia.org/wiki/Kimberley_(Western_Australia)',
  'https://en.wikipedia.org/wiki/Fly-in_fly-out',
  'https://en.wikipedia.org/wiki/Mining_in_Australia',
  'https://en.wikipedia.org/wiki/Iron_ore',
  'https://en.wikipedia.org/wiki/Coal_mining',
  'https://en.wikipedia.org/wiki/Natural_gas',
  'https://en.wikipedia.org/wiki/Solar_energy',
  'https://en.wikipedia.org/wiki/Renewable_energy_in_Australia',
  'https://en.wikipedia.org/wiki/Great_Barrier_Reef',
  'https://en.wikipedia.org/wiki/Uluru',
  'https://en.wikipedia.org/wiki/Kakadu_National_Park',
  'https://en.wikipedia.org/wiki/Sydney',
  'https://en.wikipedia.org/wiki/Melbourne',
  'https://en.wikipedia.org/wiki/Brisbane',
  'https://en.wikipedia.org/wiki/Perth,_Western_Australia',
  'https://en.wikipedia.org/wiki/Darwin,_Northern_Territory',
  'https://en.wikipedia.org/wiki/Adelaide',
  'https://en.wikipedia.org/wiki/Canberra',
  'https://en.wikipedia.org/wiki/Indigenous_Australians',
  'https://en.wikipedia.org/wiki/Australian_cuisine',
  'https://en.wikipedia.org/wiki/Australian_English',
  'https://en.wikipedia.org/wiki/Climate_of_Australia',
  'https://en.wikipedia.org/wiki/Bushfire',
  'https://en.wikipedia.org/wiki/Cyclone',
  'https://en.wikipedia.org/wiki/Kangaroo',
  'https://en.wikipedia.org/wiki/Koala',
  'https://en.wikipedia.org/wiki/Crocodile',
  'https://en.wikipedia.org/wiki/AFL_Grand_Final',
  'https://en.wikipedia.org/wiki/State_of_Origin_series',
  'https://en.wikipedia.org/wiki/The_Ashes',
  'https://en.wikipedia.org/wiki/Australian_Open',
  'https://en.wikipedia.org/wiki/Holden',
  'https://en.wikipedia.org/wiki/Toyota_HiLux',
  'https://en.wikipedia.org/wiki/FIFO_workers',

  // Dictionary / reference
  'https://www.dictionary.com/',
  'https://www.dictionary.com/browse/resilience',
  'https://www.dictionary.com/browse/sovereignty',
  'https://www.dictionary.com/browse/privacy',
  'https://www.merriam-webster.com/',
  'https://www.merriam-webster.com/dictionary/integrity',
  'https://www.merriam-webster.com/dictionary/community',
  'https://www.wolframalpha.com/',
  'https://www.britannica.com/',
  'https://www.britannica.com/place/Australia',

  // ── HEALTH & WELLBEING (10%) ──────────────────────────────────────────────
  'https://www.healthdirect.gov.au/',
  'https://www.healthdirect.gov.au/mental-health',
  'https://www.healthdirect.gov.au/sleep',
  'https://www.healthdirect.gov.au/exercise-and-fitness',
  'https://www.healthdirect.gov.au/healthy-eating',
  'https://www.healthdirect.gov.au/stress',
  'https://www.healthdirect.gov.au/mens-health',
  'https://www.healthdirect.gov.au/back-pain',
  'https://www.healthdirect.gov.au/skin-cancer',
  'https://www.beyondblue.org.au/',
  'https://www.beyondblue.org.au/mental-health/',
  'https://www.beyondblue.org.au/mental-health/depression',
  'https://www.beyondblue.org.au/mental-health/anxiety',
  'https://www.beyondblue.org.au/get-support/',
  'https://www.beyondblue.org.au/mental-health/men',
  'https://www.beyondblue.org.au/mental-health/workplace-wellbeing',
  'https://www.lifeline.org.au/',
  'https://www.lifeline.org.au/get-help/',
  'https://www.lifeline.org.au/get-help/information-and-support/self-care/',
  'https://www.headspace.com/',
  'https://www.mindhealthconnect.org.au/',
  'https://www.ruok.org.au/',
  'https://www.ruok.org.au/how-to-ask',
  'https://www.cancer.org.au/',
  'https://www.heartfoundation.org.au/',
  'https://www.diabetesaustralia.com.au/',
  'https://www.betterhealth.vic.gov.au/',
  'https://www.betterhealth.vic.gov.au/health/healthyliving/physical-activity',
  'https://www.betterhealth.vic.gov.au/health/healthyliving/sleep',
  'https://www.abc.net.au/everyday/health/',

  // ── SHOPPING & CLASSIFIEDS (10%) ──────────────────────────────────────────
  'https://www.gumtree.com.au/',
  'https://www.gumtree.com.au/s-cars-vans-utes/c18320/',
  'https://www.gumtree.com.au/s-4wd-suv/c18321/',
  'https://www.gumtree.com.au/s-tools-hardware/c18666/',
  'https://www.gumtree.com.au/s-caravans-campervans/c18662/',
  'https://www.gumtree.com.au/s-boats-jet-skis/c18377/',
  'https://www.tradingpost.com.au/',
  'https://www.carsales.com.au/',
  'https://www.carsales.com.au/cars/?q=Toyota+HiLux',
  'https://www.carsales.com.au/cars/?q=Ford+Ranger',
  'https://www.carsales.com.au/cars/?q=Land+Cruiser',
  'https://www.carsales.com.au/cars/?q=Isuzu+D-Max',
  'https://www.bikesales.com.au/',
  'https://www.caravancampingsales.com.au/',
  'https://www.boatpoint.com.au/',
  'https://www.ebay.com.au/',
  'https://www.ebay.com.au/sch/i.html?_nkw=camping+gear',
  'https://www.ebay.com.au/sch/i.html?_nkw=tools',
  'https://www.amazon.com.au/',
  'https://www.catch.com.au/',
  'https://www.kogan.com.au/',
  'https://www.bunnings.com.au/',
  'https://www.bunnings.com.au/our-range/tools/',
  'https://www.bunnings.com.au/our-range/outdoor/',
  'https://www.supercheapauto.com.au/',
  'https://www.repco.com.au/',
  'https://www.jbhifi.com.au/',
  'https://www.harveynorman.com.au/',
  'https://www.officeworks.com.au/',
  'https://www.woolworths.com.au/',
  'https://www.coles.com.au/',
  'https://www.aldi.com.au/',
  'https://www.chemistwarehouse.com.au/',

  // ── GOVERNMENT & FINANCE (5%) ─────────────────────────────────────────────
  'https://www.ato.gov.au/',
  'https://www.ato.gov.au/individuals/',
  'https://www.ato.gov.au/individuals/tax-return/',
  'https://www.ato.gov.au/individuals/super/',
  'https://www.mygov.com.au/',
  'https://www.servicesaustralia.gov.au/',
  'https://www.servicesaustralia.gov.au/centrelink',
  'https://www.servicesaustralia.gov.au/medicare',
  'https://www.humanservices.gov.au/',
  'https://www.fairwork.gov.au/',
  'https://www.fairwork.gov.au/pay-and-wages/',
  'https://www.fairwork.gov.au/leave/',
  'https://www.worksafe.wa.gov.au/',
  'https://www.dmirs.wa.gov.au/',
  'https://www.commerce.wa.gov.au/',
  'https://www.commbank.com.au/',
  'https://www.commbank.com.au/banking/',
  'https://www.nab.com.au/',
  'https://www.westpac.com.au/',
  'https://www.anz.com.au/',
  'https://www.ing.com.au/',
  'https://www.ratecity.com.au/',
  'https://www.canstar.com.au/',
  'https://www.moneysmart.gov.au/',
  'https://www.moneysmart.gov.au/superannuation-and-retirement/',

  // ── JOBS & CAREERS (FIFO specific) ────────────────────────────────────────
  'https://www.seek.com.au/',
  'https://www.seek.com.au/jobs/in-Western-Australia/',
  'https://www.seek.com.au/jobs/in-Queensland/',
  'https://www.seek.com.au/jobs/in-Northern-Territory/',
  'https://www.seek.com.au/mining-jobs/',
  'https://www.seek.com.au/fifo-jobs/',
  'https://www.seek.com.au/jobs/keyword-fly-in-fly-out/',
  'https://www.indeed.com.au/',
  'https://www.indeed.com.au/Mining-jobs',
  'https://www.linkedin.com/',
  'https://www.apsjobs.gov.au/',

  // ── REAL ESTATE ───────────────────────────────────────────────────────────
  'https://www.realestate.com.au/',
  'https://www.realestate.com.au/buy/',
  'https://www.realestate.com.au/rent/',
  'https://www.realestate.com.au/buy/in-perth%2c+wa/',
  'https://www.realestate.com.au/buy/in-brisbane%2c+qld/',
  'https://www.realestate.com.au/buy/in-darwin%2c+nt/',
  'https://www.domain.com.au/',
  'https://www.domain.com.au/buy/',

  // ── TRAVEL & LIFESTYLE ────────────────────────────────────────────────────
  'https://www.tripadvisor.com.au/',
  'https://www.airbnb.com.au/',
  'https://www.booking.com/',
  'https://www.qantas.com/',
  'https://www.qantas.com/au/en/flight-search/',
  'https://www.virginaustralia.com/',
  'https://www.jetstar.com/au/',
  'https://www.webjet.com.au/',
  'https://www.campermate.com.au/',
  'https://www.wikicamps.com.au/',
  'https://www.exploroz.com/',
  'https://www.4wdingaustralia.com/',
  'https://www.caravanworld.com.au/',

  // ── SOCIAL & COMMUNITY ────────────────────────────────────────────────────
  'https://www.reddit.com/r/australia/',
  'https://www.reddit.com/r/Perth/',
  'https://www.reddit.com/r/brisbane/',
  'https://www.reddit.com/r/mining/',
  'https://www.reddit.com/r/fifo/',
  'https://www.reddit.com/r/AskAustralia/',
  'https://www.reddit.com/r/AFL/',
  'https://www.reddit.com/r/NRL/',
  'https://www.reddit.com/r/Cricket/',
  'https://www.reddit.com/r/motorcycles/',
  'https://www.reddit.com/r/4x4/',
  'https://www.reddit.com/r/camping/',
  'https://www.reddit.com/r/homebrewing/',
  'https://www.reddit.com/r/DIY/',
  'https://www.reddit.com/r/personalfinance/',
  'https://whirlpool.net.au/',
  'https://forums.whirlpool.net.au/',

  // ── TECHNOLOGY ────────────────────────────────────────────────────────────
  'https://www.abc.net.au/news/science-environment/technology/',
  'https://www.smh.com.au/technology/',
  'https://www.techradar.com/',
  'https://www.pcmag.com/',
  'https://arstechnica.com/',
  'https://www.wired.com/',
  'https://www.theverge.com/',
  'https://techcrunch.com/',
  'https://www.cnet.com/',
  'https://www.zdnet.com/',
  'https://www.bleepingcomputer.com/',
  'https://github.com/',
  'https://stackoverflow.com/',
  'https://www.cloudflare.com/learning/',
  'https://news.ycombinator.com/',

  // ── FOOD & RECIPES ────────────────────────────────────────────────────────
  'https://www.taste.com.au/',
  'https://www.taste.com.au/recipes/',
  'https://www.taste.com.au/recipes/collections/bbq-recipes/',
  'https://www.taste.com.au/recipes/collections/slow-cooker/',
  'https://www.allrecipes.com/',
  'https://www.delicious.com.au/',
  'https://www.donnahay.com.au/',
  'https://www.foodnetwork.com/',

  // ── OUTDOORS & FISHING ────────────────────────────────────────────────────
  'https://www.fishingworld.com.au/',
  'https://www.fishingmonthly.net.au/',
  'https://www.tackletactics.com.au/',
  'https://www.bcf.com.au/',
  'https://www.anacondastores.com/',
  'https://www.snowys.com.au/',
  'https://www.tentworld.com.au/',
  'https://www.boating.com.au/',
  'https://www.huntersandfishers.com.au/',

  // ── MUSIC & ENTERTAINMENT ─────────────────────────────────────────────────
  'https://www.abc.net.au/triplej/',
  'https://www.triplem.com.au/',
  'https://www.nova.com.au/',
  'https://www.rottentomatoes.com/',
  'https://www.imdb.com/',
  'https://www.imdb.com/chart/top/',
  'https://www.imdb.com/chart/moviemeter/',
  'https://letterboxd.com/',

  // ── MISCELLANEOUS REAL PAGES ──────────────────────────────────────────────
  'https://www.google.com.au/',
  'https://maps.google.com.au/',
  'https://translate.google.com/',
  'https://www.timeanddate.com/calendar/',
  'https://www.timeanddate.com/weather/australia/',
  'https://www.xe.com/currencyconverter/',
  'https://www.oanda.com/currency-converter/',
  'https://www.calculator.net/',
  'https://www.wolframalpha.com/',
  'https://www.convertunits.com/',
  'https://www.metric-conversions.org/',
  'https://postninja.com.au/',
  'https://auspost.com.au/',
  'https://auspost.com.au/mypost/',
  'https://www.energymadeeasy.gov.au/',
  'https://www.finder.com.au/',
  'https://www.finder.com.au/personal-loans',
  'https://www.comparethemarket.com.au/',
  'https://iselect.com.au/',
  'https://www.productreview.com.au/',
  'https://www.choice.com.au/',
  'https://www.accc.gov.au/',
  'https://www.ombudsman.gov.au/',
  'https://www.tga.gov.au/',
  'https://www.infrastructure.gov.au/',
  'https://www.environment.gov.au/',
  'https://www.dcceew.gov.au/',

  // ── MORE FIFO / MINING SPECIFIC ──────────────────────────────────────────
  'https://www.miningweekly.com/',
  'https://www.miningweekly.com/topic/australia',
  'https://www.mining.com.au/',
  'https://www.australianmining.com.au/',
  'https://www.resourcesandgeoscience.nsw.gov.au/',
  'https://www.dmp.wa.gov.au/',
  'https://www.industry.gov.au/mining-petroleum-and-resources/',
  'https://www.minerals.org.au/',
  'https://www.woodside.com/',
  'https://www.riotinto.com/',
  'https://www.bhp.com/',
  'https://www.fortescue.com/',
  'https://www.chevron.com/australia',
  'https://www.santos.com/',
  'https://www.oricaminingservices.com/',
  'https://www.monadelphous.com.au/',
  'https://www.thiess.com/',
  'https://www.macmahon.com.au/',
  'https://www.perentigroup.com/',
  'https://www.programmed.com.au/',

  // ── MORE COMMUNITY / LIFESTYLE ────────────────────────────────────────────
  'https://www.abc.net.au/religion/',
  'https://www.abc.net.au/arts/',
  'https://www.abc.net.au/radionational/',
  'https://www.abc.net.au/local/wa/',
  'https://www.abc.net.au/local/qld/',
  'https://www.abc.net.au/local/nt/',
  'https://www.abc.net.au/kids/',
  'https://www.kidspot.com.au/',
  'https://www.essentialbaby.com.au/',
  'https://www.babycentre.com.au/',
  'https://raisingchildren.net.au/',
  'https://www.canteenkids.org.au/',
  'https://www.savethechildren.org.au/',
  'https://www.redcross.org.au/',
  'https://www.salvationarmy.org.au/',
  'https://www.unitingcare.org.au/',

  // ── MORE TECH / TOOLS ─────────────────────────────────────────────────────
  'https://www.speedtest.net/',
  'https://fast.com/',
  'https://www.whatismyip.com/',
  'https://haveibeenpwned.com/',
  'https://www.virustotal.com/',
  'https://www.shodan.io/',
  'https://www.exploit-db.com/',
  'https://www.kb.cert.org/',
  'https://nvd.nist.gov/',
  'https://www.cvedetails.com/',
  'https://www.sans.org/',
  'https://www.owasp.org/',
  'https://www.privacytools.io/',
  'https://www.eff.org/',
  'https://www.torproject.org/',
  'https://mullvad.net/',
  'https://proton.me/',
  'https://signal.org/',
  'https://www.mozilla.org/',
  'https://www.mozilla.org/en-US/firefox/',

  // ── MORE SPORT ────────────────────────────────────────────────────────────
  'https://www.olympics.com/',
  'https://www.commonwealthgames.com/',
  'https://www.swimming.org.au/',
  'https://www.athletics.org.au/',
  'https://www.rugbyaustralia.com.au/',
  'https://www.hockey.org.au/',
  'https://www.basketballaustralia.com.au/',
  'https://www.golf.org.au/',
  'https://www.bowls.com.au/',
  'https://www.netball.com.au/',
  'https://www.surfingaustralia.com/',
  'https://www.cycling.org.au/',
  'https://www.gymnastics.org.au/',
  'https://www.boxing.org.au/',
  'https://www.mma.com.au/',
  'https://www.ufc.com/',
  'https://www.pga.com.au/',
  'https://www.skysports.com/',
  'https://www.espn.com/',
  'https://www.goal.com/en-au',

  // ── MORE REFERENCE ────────────────────────────────────────────────────────
  'https://en.wikipedia.org/wiki/Iron_ore_mining_in_Australia',
  'https://en.wikipedia.org/wiki/Fortescue_Metals_Group',
  'https://en.wikipedia.org/wiki/BHP',
  'https://en.wikipedia.org/wiki/Rio_Tinto_(corporation)',
  'https://en.wikipedia.org/wiki/Pilbara_iron',
  'https://en.wikipedia.org/wiki/Karratha',
  'https://en.wikipedia.org/wiki/Port_Hedland',
  'https://en.wikipedia.org/wiki/Newman,_Western_Australia',
  'https://en.wikipedia.org/wiki/Tom_Price,_Western_Australia',
  'https://en.wikipedia.org/wiki/Paraburdoo',
  'https://en.wikipedia.org/wiki/Dampier,_Western_Australia',
  'https://en.wikipedia.org/wiki/Bowen_Basin',
  'https://en.wikipedia.org/wiki/Mackay,_Queensland',
  'https://en.wikipedia.org/wiki/Rockhampton',
  'https://en.wikipedia.org/wiki/Mount_Isa',
  'https://en.wikipedia.org/wiki/Broken_Hill',
  'https://en.wikipedia.org/wiki/Kalgoorlie',
  'https://en.wikipedia.org/wiki/Esperance,_Western_Australia',
  'https://en.wikipedia.org/wiki/Geraldton',
  'https://en.wikipedia.org/wiki/Exmouth,_Western_Australia',

];

// ── Timing (Poisson-distributed, FIFO worker pattern) ────────────────────────
const TIME_OF_DAY_FACTOR = {
   5: 0.5,                       // early wake
   6: 1.2,  7: 1.2,  8: 1.2,   // morning scroll before shift
   9: 0.6, 10: 0.6, 11: 0.6,   // on shift
  12: 1.0, 13: 0.8,             // smoko / lunch
  14: 0.6, 15: 0.6, 16: 0.6,   // afternoon shift
  17: 1.5, 18: 1.5, 19: 1.5,   // knock off, evening peak
  20: 1.5, 21: 1.3, 22: 0.8,   // evening wind down
  23: 0.3,  0: 0.3,  1: 0.3,   // sleep
   2: 0.3,  3: 0.3,  4: 0.3,   // sleep
};

const BASE_INTERVAL_MS = 60000;  // 60 seconds base

function poissonInterval() {
  const hour   = new Date().getHours();
  const factor = TIME_OF_DAY_FACTOR[hour] ?? 0.6;
  const lambda = factor;
  const sample = -Math.log(Math.random()) / lambda;
  // Clamp to 20s – 150s — feels human, not robotic
  return Math.max(20000, Math.min(150000, sample * BASE_INTERVAL_MS));
}

// ── Request variety ───────────────────────────────────────────────────────────
// Real conversations — mostly GET (full page), occasional HEAD
// No more 70% HEAD — a real person fetches pages, not just headers
function pickMethod() {
  return Math.random() < 0.15 ? 'HEAD' : 'GET';  // 85% GET, 15% HEAD
}

// ── Rotate user agents — look like real browsers ──────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; Samsung Galaxy S21) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 11; Redmi Note 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ── Noise fetch ───────────────────────────────────────────────────────────────
async function makeNoise() {
  const url    = NOISE_URLS[Math.floor(Math.random() * NOISE_URLS.length)];
  const method = pickMethod();

  try {
    const controller = new AbortController();
    // Abort after 8 seconds — real browsing doesn't wait forever
    const timeout = setTimeout(() => controller.abort(), 8000);

    await fetch(url, {
      method,
      mode:        'no-cors',
      credentials: 'omit',
      cache:       'no-store',
      signal:      controller.signal,
      headers: {
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      }
    });

    clearTimeout(timeout);
    // Deliberately ignore response — we don't care about content
  } catch (e) {
    // Silent — noise failures are expected and irrelevant
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────
async function noiseLoop() {
  while (true) {
    const interval = poissonInterval();
    await new Promise(resolve => setTimeout(resolve, interval));
    await makeNoise();
  }
}

console.log(`[noise-worker] Cover traffic started. ${NOISE_URLS.length} URLs loaded.`);
noiseLoop();
