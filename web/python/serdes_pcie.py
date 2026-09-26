"""Executable reference for the PCI Express lesson.

Per-lane rate and line code of each generation, the bytes a transaction-layer packet (TLP) occupies on the wire, and
one direction of a link simulated event by event: the sender spends a credit on every new TLP and keeps a copy until
it is acknowledged, the receiver accepts TLPs in sequence and answers a damaged or out-of-order one with a single NAK,
after which the sender resends every unacknowledged TLP; a replay timer covers a lost answer. Times are in ns, sizes
in bytes. src/illustrations/pcie/model.ts follows this line by line; tests/pcie-model.test.ts compares them.
"""
import bisect

GENERATIONS = [  # generation, GT/s per lane, year, line code
    (1, 2.5, 2003, '8b/10b'),
    (2, 5.0, 2007, '8b/10b'),
    (3, 8.0, 2010, '128b/130b'),
    (4, 16.0, 2017, '128b/130b'),
    (5, 32.0, 2019, '128b/130b'),
    (6, 64.0, 2022, 'flit'),
    (7, 128.0, 2025, 'flit'),
]
TLP_WRAP = 8          # framing token + sequence number + LCRC around every TLP before flit mode
FLIT, FLIT_TLP, FLIT_LINK = 256, 236, 242


def code_efficiency(code):
    return 0.8 if code == '8b/10b' else 128 / 130 if code == '128b/130b' else FLIT_LINK / FLIT


def link_gbps(g, lanes):
    return lanes * g[1] * code_efficiency(g[3]) / 8


def wire_bytes(g, payload, header):
    return header + payload + (0 if g[3] == 'flit' else TLP_WRAP)


def for_packets(g):
    return FLIT_TLP / FLIT if g[3] == 'flit' else code_efficiency(g[3])


def payload_share(g, payload, header):
    return payload / wire_bytes(g, payload, header) * for_packets(g)


def tlp_ns(g, lanes, payload, header):
    return wire_bytes(g, payload, header) * 8 / (lanes * g[1] * for_packets(g))


def simulate_link(p, horizon, corrupt=()):
    """p = dict(tlpNs, latencyNs, drainNs, credits). Returns sends, dllps, accepted, drained, released."""
    bad = set(corrupt)
    sends, dllps, accepted, drained, released, first_start = [], [], {}, {}, {}, []
    queue = []                                  # (t, n, kind, x), kept sorted
    state = dict(count=0, timer=0, timing=False, credits=p['credits'], next_seq=0, link_free=0.0, expected=0,
                 nak_pending=False, device_free=0.0)
    unacked, resend = [], []
    timeout = 3 * (p['tlpNs'] + 2 * p['latencyNs'])
    lat = p['latencyNs']

    def push(t, kind, x=0):
        n = state['count']
        state['count'] += 1
        bisect.insort(queue, (t, n, kind, x))

    def arm(t):
        state['timing'] = True
        state['timer'] += 1
        push(t + timeout, 'timer', state['timer'])

    def release(up_to, t):
        freed = False
        while unacked and unacked[0] <= up_to:
            released[unacked.pop(0)] = t
            freed = True
        if not freed:
            return
        if unacked:
            arm(t)
        else:
            state['timing'] = False
            state['timer'] += 1

    def reply(kind, seq, t):
        dllps.append((kind, seq, t, t + lat))
        push(t + lat, kind, seq)

    def replay_all(t):
        resend[:] = unacked[:]
        if state['link_free'] <= t:
            push(t, 'send')

    push(0.0, 'send')
    while queue and queue[0][0] <= horizon:
        t, _, kind, x = queue.pop(0)
        if kind == 'send':
            if t < state['link_free']:
                continue
            while resend and resend[0] in released:
                resend.pop(0)
            if resend:
                seq, again = resend.pop(0), True
            elif state['credits'] > 0:
                seq, again = state['next_seq'], False
                state['next_seq'] += 1
                state['credits'] -= 1
                unacked.append(seq)
                first_start.append(t)
            else:
                continue
            i, end = len(sends), t + p['tlpNs']
            sends.append(dict(seq=seq, start=t, end=end, arrive=end + lat, replay=again, corrupt=i in bad,
                              fate='pending'))
            push(end + lat, 'arrive', i)
            state['link_free'] = end
            push(end, 'send')
            if not state['timing']:
                arm(end)
        elif kind == 'arrive':
            s = sends[x]
            if not s['corrupt'] and s['seq'] == state['expected']:
                s['fate'] = 'accepted'
                state['expected'] += 1
                state['nak_pending'] = False
                accepted[s['seq']] = t
                reply('ack', s['seq'], t)
                state['device_free'] = max(state['device_free'], t) + p['drainNs']
                push(state['device_free'], 'drain', s['seq'])
            elif not s['corrupt'] and s['seq'] < state['expected']:
                s['fate'] = 'dropped'
                reply('ack', state['expected'] - 1, t)
            else:
                s['fate'] = 'corrupt' if s['corrupt'] else 'dropped'
                if not state['nak_pending']:
                    state['nak_pending'] = True
                    reply('nak', state['expected'] - 1, t)
        elif kind == 'drain':
            drained[x] = t
            reply('credit', x, t)
        elif kind == 'credit':
            state['credits'] += 1
            if state['link_free'] <= t:
                push(t, 'send')
        elif kind == 'ack':
            release(x, t)
        elif kind == 'nak':
            release(x, t)
            replay_all(t)
            arm(t)
        elif x == state['timer'] and unacked:
            replay_all(t)
            arm(t)
    return sends, dllps, accepted, drained, released


def credit_limit(p):
    loop = p['tlpNs'] + 2 * p['latencyNs'] + p['drainNs']
    return min(1.0, p['credits'] * p['tlpNs'] / loop, p['tlpNs'] / p['drainNs'] if p['drainNs'] > 0 else 1.0)


def measured_share(accepted, p, t0, t1):
    k = sum(1 for a in accepted.values() if t0 < a <= t1)
    return k * p['tlpNs'] / (t1 - t0)


def link_params(gen, lanes, payload, header, latency, drain, credits):
    return dict(tlpNs=tlp_ns(GENERATIONS[gen - 1], lanes, payload, header), latencyNs=latency, drainNs=drain,
                credits=credits)


def main():
    print('gen GT/s code GB/s_per_lane GB/s_x16')
    for g in GENERATIONS:
        print(f'{g[0]} {g[1]:g} {g[3]} {link_gbps(g, 1):.6f} {link_gbps(g, 16):.6f}')
    print('payload share gen3_3dw gen3_4dw gen6_4dw')
    for payload in (16, 32, 64, 128, 256, 512, 1024, 2048, 4096):
        g3, g6 = GENERATIONS[2], GENERATIONS[5]
        print(f'{payload} {payload_share(g3, payload, 12):.6f} {payload_share(g3, payload, 16):.6f} '
              f'{payload_share(g6, payload, 16):.6f}')
    base = link_params(3, 4, 256, 16, 100.0, 40.0, 8)
    print(f"tlp_ns gen3_x4_256B {base['tlpNs']:.6f}")
    print('credits limit measured')
    for credits in (1, 2, 3, 4, 5, 6, 8, 12):
        p = dict(base, credits=credits)
        sends, dllps, accepted, drained, released = simulate_link(p, 20000.0)
        print(f'{credits} {credit_limit(p):.6f} {measured_share(accepted, p, 5000.0, 20000.0):.6f}')
    print('case sends replays accepted acks naks credits last_accept')
    cases = {
        'clean': (base, ()),
        'one_error': (base, (10,)),
        'error_in_replay': (base, (10, 16)),
        'two_errors': (base, (10, 40)),
        'x16_gen5': (link_params(5, 16, 256, 16, 100.0, 4.0, 32), (50,)),
    }
    for name, (p, corrupt) in cases.items():
        sends, dllps, accepted, drained, released = simulate_link(p, 4000.0, corrupt)
        kinds = [d[0] for d in dllps]
        last = max(accepted.values())
        print(f"{name} {len(sends)} {sum(s['replay'] for s in sends)} {len(accepted)} {kinds.count('ack')} "
              f"{kinds.count('nak')} {kinds.count('credit')} {last:.6f}")
        order = [s for s in sorted(accepted, key=lambda q: accepted[q])]
        assert order == list(range(len(order))), 'accepted out of order'


if __name__ == '__main__':
    main()
