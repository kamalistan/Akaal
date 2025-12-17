import Layout from "./Layout.jsx";

import Home from "./Home";

import Leads from "./Leads";

import Leaderboard from "./Leaderboard";

import Metrics from "./Metrics";

import Achievements from "./Achievements";

import Settings from "./Settings";

import PhoneManager from "./PhoneManager";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {

    Home: Home,

    Leads: Leads,

    Leaderboard: Leaderboard,

    Metrics: Metrics,

    Achievements: Achievements,

    Settings: Settings,

    PhoneManager: PhoneManager,

}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Home />} />
                
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/Leads" element={<Leads />} />
                
                <Route path="/Leaderboard" element={<Leaderboard />} />
                
                <Route path="/Metrics" element={<Metrics />} />
                
                <Route path="/Achievements" element={<Achievements />} />

                <Route path="/Settings" element={<Settings />} />

                <Route path="/PhoneManager" element={<PhoneManager />} />

            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}