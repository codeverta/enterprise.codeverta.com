import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

const payload = JSON.parse(open('./payload.json'));
const rateLimitCounter = new Counter('rate_limit_hits');

export const options = {
    scenarios: {
        ticketing_war: {
            executor: 'ramping-arrival-rate',
            startRate: 50,
            timeUnit: '1s',
            preAllocatedVUs: 500,
            maxVUs: 5000,
            stages: [
                { target: 250, duration: '1m' },
                { target: 500, duration: '1m' },
            ],
        },
    },
    thresholds: {
        // PENTING: Jangan gunakan 'abortOnFail: true' agar test tidak berhenti mendadak
        http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: false }],
        http_req_duration: [{ threshold: 'p(95)<1000', abortOnFail: false }],
    },
};

export default function () {
    const url = 'https://api.malabartrailrun.id/api/participants/register';
    const params = {
        headers: { 'Content-Type': 'application/json' },
        timeout: '120s', // Naikkan timeout agar tidak sering 'context canceled'
    };

    const res = http.post(url, JSON.stringify(payload), params);

    if (res.status === 429) {
        rateLimitCounter.add(1);
    }

    check(res, {
        'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
        'has success message': (r) => {
            // Defensive check: pastikan r.body ada sebelum di-parse
            try {
                if (r.body && r.status === 200) {
                    return r.json().success === true;
                }
            } catch (e) {
                return false;
            }
            return false;
        },
    });
}

export function handleSummary(data) {
    // Memberikan output ke terminal dan ke file HTML
    console.log('Generating Report...');
    return {
        "summary.html": htmlReport(data),
        "stdout": textSummary(data, { indent: " ", enableColors: true }),
    };
}