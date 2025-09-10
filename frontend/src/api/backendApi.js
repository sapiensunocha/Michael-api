import { supabase } from '../lib/supabaseClient'; // Import your Supabase client instance

/**
 * @desc Handles user login using Supabase Auth.
 * @param {Object} credentials - Object containing email and password.
 * @returns {Promise<Object>} User data including session and enriched user object.
 */
export const loginUser = async (credentials) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    console.error('Supabase Login Error:', error);
    throw new Error(error.message || 'Login failed. Please check your credentials.');
  }

  // NEW: Fetch the complete partner profile after successful authentication
  const partnerProfile = await getPartnerProfile();
  const enrichedUser = partnerProfile ? { ...data.user, ...partnerProfile } : data.user;

  return {
    token: data.session?.access_token,
    user: enrichedUser,
  };
};

/**
 * @desc Handles user registration using Supabase Auth.
 * @param {Object} userData - Object containing name, email, and password.
 * @returns {Promise<Object>} User data including session and enriched user object.
 */
export const registerUser = async (userData) => {
  const { data, error } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: {
        name: userData.name,
      },
    },
  });

  if (error) {
    console.error('Supabase Registration Error:', error);
    throw new Error(error.message || 'Registration failed. User might already exist or email confirmation is required.');
  }

  // NEW: Fetch the complete partner profile after successful registration
  const partnerProfile = await getPartnerProfile();
  const enrichedUser = partnerProfile ? { ...data.user, ...partnerProfile } : data.user;

  return {
    token: data.session?.access_token,
    user: enrichedUser,
  };
};

/**
 * @desc Sends a password reset email using Supabase Auth.
 * @param {string} email - The email address to send the reset link to.
 * @returns {Promise<void>}
 */
export const sendPasswordResetEmail = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    console.error('Supabase Password Reset Error:', error);
    throw new Error(error.message || 'Failed to send password reset email.');
  }
};

/**
 * @desc Fetches the authenticated partner's profile, their API key, and their subscriptions from Supabase.
 * @returns {Promise<Object|null>} Partner data including profile, API key, and subscriptions, or null if not found.
 */
export const getPartnerProfile = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Auth error in getPartnerProfile:', authError);
    return null; // Return null if no authenticated user
  }

  // 1. Fetch user_profiles data
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Supabase Profile Fetch Error:', profileError);
    return null;
  }

  // 2. Fetch API key data from api_keys table separately
  const { data: apiKeyData, error: apiKeyError } = await supabase
    .from('api_keys')
    .select('api_key, plan, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (apiKeyError) {
    console.error('Supabase API Key Fetch Error:', apiKeyError);
  }

  // 3. Fetch user_subscriptions data separately
  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id);

  if (subscriptionsError) {
    console.error('Supabase Subscriptions Fetch Error:', subscriptionsError);
  }

  // Combine all fetched data into a single profile object
  const finalProfile = {
      ...(profile || {}),
      api_key: apiKeyData ? apiKeyData.api_key : null,
      api_plan: apiKeyData ? apiKeyData.plan : null,
      api_status: apiKeyData ? apiKeyData.status : null,
      user_subscriptions: subscriptions || [],
  };

  return finalProfile;
};

/**
 * @desc Fetches all available subscription plans from the Supabase Edge Function.
 * @param {string} token - The JWT token of the authenticated user.
 * @returns {Promise<Array<Object>>}
 */
export const getPlans = async (token) => {
  const { data, error } = await supabase.functions.invoke('get-plans', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    console.error('Supabase Edge Function Error [get-plans]:', error);
    throw new Error(data?.error || 'Failed to retrieve plans from Edge Function.');
  }
  return data;
};

/**
 * @desc Creates a Stripe Checkout Session using the Supabase Edge Function.
 * @param {string} token - The JWT token of the authenticated user.
 * @param {string} planId - The ID of the selected plan.
 * @param {string} successUrl - URL for successful payment redirect.
 * @param {string} cancelUrl - URL for cancelled payment redirect.
 * @param {string} [name] - Optional user name for Stripe display.
 * @returns {Promise<Object>}
 */
export const createCheckoutSession = async (token, planId, successUrl, cancelUrl, name) => {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      planId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      name,
    }),
  });

  if (error) {
    console.error('Supabase Edge Function Error [create-checkout-session]:', error);
    console.error('Backend error details:', data);
    throw new Error(data?.error || 'Failed to create checkout session. Please try again.');
  }
  return data;
};

/**
 * @desc Confirms a user using the token sent via email after registration.
 * @param {string} token - The confirmation token from the email link.
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
export const confirmUser = async (token) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    return {
      success: data.success || false,
      message: data.message || '',
    };
  } catch (err) {
    console.error('Error confirming user:', err);
    return { success: false, message: err.message || 'Confirmation failed.' };
  }
};

/**
 * @desc Fetches global dashboard summary data and active alerts from all raw data tables.
 * @returns {Promise<Object>} Object containing globalSummary and activeAlerts.
 */
export const getGlobalDashboardData = async () => {
  console.log('Fetching and processing global dashboard data from raw tables...');

  let allAlerts = [];
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Helper functions to transform raw data to a unified format
  const transformUsgsData = (raw) => ({
    id: `usgs-${raw.usgs_event_id}`,
    source_event_id: raw.usgs_event_id,
    source: 'USGS',
    event_type: 'Earthquake',
    latitude: parseFloat(raw.raw_data?.latitude),
    longitude: parseFloat(raw.raw_data?.longitude),
    severity_level: Math.floor(parseFloat(raw.raw_data?.mag)),
    location_name: raw.raw_data?.place,
    alert_message: `Magnitude ${raw.raw_data?.mag} earthquake`,
    start_time: new Date(raw.raw_data?.time).toISOString(),
  });

  const transformGdacsData = (raw) => ({
    id: `gdacs-${raw.gdacs_event_id}`,
    source_event_id: raw.gdacs_event_id,
    source: 'GDACS',
    event_type: raw.raw_feature?.properties?.eventtype,
    latitude: raw.raw_feature?.properties?.latitude,
    longitude: raw.raw_feature?.properties?.longitude,
    severity_level: raw.raw_feature?.properties?.severitylevel,
    location_name: raw.raw_feature?.properties?.countryname,
    alert_message: raw.raw_feature?.properties?.alertlevel,
    start_time: new Date(raw.raw_feature?.properties?.eventdate).toISOString(),
  });

  const transformFirmsData = (raw) => {
    const timeString = raw.raw_fire_data?.acq_time.padStart(4, '0');
    const isoDate = `${raw.raw_fire_data?.acq_date}T${timeString.substring(0, 2)}:${timeString.substring(2, 4)}:00.000Z`;
    return {
      id: `firms-${raw.firms_event_id}`,
      source_event_id: raw.firms_event_id,
      source: 'FIRMS',
      event_type: 'Wildfire Warning',
      latitude: parseFloat(raw.raw_fire_data?.latitude),
      longitude: parseFloat(raw.raw_fire_data?.longitude),
      severity_level: Math.floor(raw.raw_fire_data?.confidence / 20) + 1, // Map confidence (0-100) to severity (1-5)
      location_name: `Wildfire near ${raw.raw_fire_data?.country}`,
      alert_message: `High confidence wildfire detected.`,
      start_time: new Date(isoDate).toISOString(),
    };
  };

  const transformAcledData = (raw) => ({
    id: `acled-${raw.acled_event_id}`,
    source_event_id: raw.acled_event_id,
    source: 'ACLED',
    event_type: raw.raw_event_data?.event_type,
    latitude: parseFloat(raw.raw_event_data?.latitude),
    longitude: parseFloat(raw.raw_event_data?.longitude),
    severity_level: raw.raw_event_data?.fatalities > 0 ? (raw.raw_event_data?.fatalities > 10 ? 5 : 3) : 1, // Map fatalities to severity
    location_name: raw.raw_event_data?.location,
    alert_message: `${raw.raw_event_data?.fatalities} fatalities reported.`,
    start_time: new Date(raw.raw_event_data?.event_date).toISOString(),
  });

  try {
    // Fetch from all raw tables in parallel
    const [
      { data: usgsData, error: usgsError },
      { data: gdacsData, error: gdacsError },
      { data: firmsData, error: firmsError },
      { data: acledData, error: acledError }
    ] = await Promise.all([
      supabase.from('usgs_raw').select('usgs_event_id, raw_data').gte('created_at', oneDayAgo),
      supabase.from('gdacs_raw').select('gdacs_event_id, raw_feature').gte('created_at', oneDayAgo),
      supabase.from('firms_raw').select('firms_event_id, raw_fire_data').gte('created_at', oneDayAgo),
      supabase.from('acled_raw').select('acled_event_id, raw_event_data').gte('created_at', oneDayAgo),
    ]);

    if (usgsError) console.error('Error fetching USGS data:', usgsError.message);
    if (gdacsError) console.error('Error fetching GDACS data:', gdacsError.message);
    if (firmsError) console.error('Error fetching FIRMS data:', firmsError.message);
    if (acledError) console.error('Error fetching ACLED data:', acledError.message);

    // Transform and combine data
    if (usgsData) allAlerts.push(...usgsData.map(transformUsgsData));
    if (gdacsData) allAlerts.push(...gdacsData.map(transformGdacsData));
    if (firmsData) allAlerts.push(...firmsData.map(transformFirmsData));
    if (acledData) allAlerts.push(...acledData.map(transformAcledData));

    // Sort the combined alerts by start time, most recent first
    allAlerts.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    // Calculate summary statistics
    let criticalAlertsCount = 0;
    const uniqueLocations = new Set();
    let maxSeverity = 0;
    const uniqueSources = new Set();
    const uniqueSourceEvents = new Set();

    allAlerts.forEach(alert => {
      if (!uniqueSourceEvents.has(alert.source_event_id)) {
        uniqueSourceEvents.add(alert.source_event_id);
        if (alert.severity_level >= 4) criticalAlertsCount++;
        uniqueSources.add(alert.source);
      }
      if (alert.location_name) uniqueLocations.add(alert.location_name);
      if (alert.severity_level && alert.severity_level > maxSeverity) maxSeverity = alert.severity_level;
    });

    let globalSeverityLevelText = 'No Active Alerts';
    if (allAlerts.length > 0) {
      if (maxSeverity >= 5) globalSeverityLevelText = 'High Global Severity';
      else if (maxSeverity >= 3) globalSeverityLevelText = 'Moderate Global Severity';
      else globalSeverityLevelText = 'Low Global Severity';
    }

    const globalSummary = {
      criticalAlerts: criticalAlertsCount,
      locationsAffectedWorldwide: uniqueLocations.size,
      globalSeverityLevel: globalSeverityLevelText,
      totalSources: uniqueSources.size,
    };

    return { globalSummary, activeAlerts: allAlerts };

  } catch (err) {
    console.error("An unexpected error occurred while fetching global dashboard data:", err);
    // Return empty data on failure to prevent app crash
    return {
      globalSummary: {
        criticalAlerts: 0,
        locationsAffectedWorldwide: 0,
        globalSeverityLevel: 'N/A',
        totalSources: 0
      },
      activeAlerts: []
    };
  }
};


/**
 * @desc Fetches trending insights data by processing raw data.
 * @returns {Promise<Array<Object>>} Array of trending insight data.
 */
export const getTrendingInsights = async () => {
  console.log('Processing real data for trending insights...');

  // Fetch all alerts from the past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let allAlerts = [];

  const transformUsgsData = (raw) => ({ event_type: 'Earthquake', start_time: new Date(raw.raw_data?.time) });
  const transformGdacsData = (raw) => ({ event_type: raw.raw_feature?.properties?.eventtype, start_time: new Date(raw.raw_feature?.properties?.eventdate) });
  const transformFirmsData = (raw) => {
    const timeString = raw.raw_fire_data?.acq_time.padStart(4, '0');
    const isoDate = `${raw.raw_fire_data?.acq_date}T${timeString.substring(0, 2)}:${timeString.substring(2, 4)}:00.000Z`;
    return { event_type: 'Wildfire Warning', start_time: new Date(isoDate) };
  };
  const transformAcledData = (raw) => ({ event_type: raw.raw_event_data?.event_type, start_time: new Date(raw.raw_event_data?.event_date) });

  try {
    const [
      { data: usgsData },
      { data: gdacsData },
      { data: firmsData },
      { data: acledData }
    ] = await Promise.all([
      supabase.from('usgs_raw').select('raw_data').gte('created_at', sevenDaysAgo),
      supabase.from('gdacs_raw').select('raw_feature').gte('created_at', sevenDaysAgo),
      supabase.from('firms_raw').select('raw_fire_data').gte('created_at', sevenDaysAgo),
      supabase.from('acled_raw').select('raw_event_data').gte('created_at', sevenDaysAgo),
    ]);

    if (usgsData) allAlerts.push(...usgsData.map(transformUsgsData));
    if (gdacsData) allAlerts.push(...gdacsData.map(transformGdacsData));
    if (firmsData) allAlerts.push(...firmsData.map(transformFirmsData));
    if (acledData) allAlerts.push(...acledData.map(transformAcledData));

    const groupedByDateAndType = {};
    allAlerts.forEach(alert => {
      const dateKey = alert.start_time.toISOString().split('T')[0];
      const eventType = alert.event_type;
      if (!groupedByDateAndType[dateKey]) {
        groupedByDateAndType[dateKey] = {};
      }
      groupedByDateAndType[dateKey][eventType] = (groupedByDateAndType[dateKey][eventType] || 0) + 1;
    });

    const insightsData = Object.keys(groupedByDateAndType).map(date => {
      return {
        date,
        ...groupedByDateAndType[date]
      };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    return insightsData;
  } catch (err) {
    console.error('Error fetching trending insights:', err);
    // Return placeholder data on failure to prevent app crash
    return [];
  }
};

/**
 * @desc Invokes a Supabase Edge Function to generate a global summary message using AI.
 * @param {Object} dataForAI - An object containing relevant data for the AI (e.g., activeAlerts, globalSummary).
 * @param {string} token - The JWT token of the authenticated user.
 * @returns {Promise<string>} The AI-generated three-line summary message.
 */
export const generateWorldSummary = async (dataForAI, token) => {
  if (!token) throw new Error('Authentication token is required to generate AI summary.');

  try {
    const { data, error } = await supabase.functions.invoke('-generate-world-summary-', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dataForAI),
    });

    if (error) {
      console.error('Supabase Edge Function Error [-generate-world-summary-]:', error);
      throw new Error(data?.error || 'Failed to generate AI summary from Edge Function.');
    }

    return data?.message || 'Failed to generate a world summary. Please try again later.';
  } catch (err) {
    console.error('Error in generateWorldSummary API call:', err);
    throw err;
  }
};
