#!/usr/bin/env python3
"""
SeemaSetu — India Border Intelligence Map Generator
====================================================
Generates a high-quality, interactive matplotlib map of India's 2026 borders.

Usage:
    python generate_border_map.py

Requirements:
    pip install matplotlib geopandas shapely numpy

Output:
    india_border_intelligence_map.png  (static high-res export)
    india_border_map_interactive.html  (interactive Plotly version)
"""

import sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.patheffects as pe
from matplotlib.patches import FancyArrowPatch, Circle, FancyBboxPatch
from matplotlib.collections import LineCollection
from matplotlib.lines import Line2D
from matplotlib.widgets import Button
import warnings
warnings.filterwarnings('ignore')

# ── DATA ─────────────────────────────────────────────────────────────────────

LAND_ICPS = [
    {'name': 'Attari–Wagah ICP',  'lat': 31.604, 'lng': 74.574, 'alert': 'HIGH',     'travellers': 8240, 'country': 'Pakistan', 'personnel': 340, 'incidents': 12},
    {'name': 'Wagah Rail ICP',    'lat': 31.721, 'lng': 74.601, 'alert': 'ELEVATED',  'travellers': 2400, 'country': 'Pakistan', 'personnel': 180, 'incidents': 5},
    {'name': 'Petrapole ICP',     'lat': 23.008, 'lng': 88.888, 'alert': 'NORMAL',    'travellers': 5621, 'country': 'Bangladesh','personnel': 280, 'incidents': 2},
    {'name': 'Raxaul–Birgunj',   'lat': 26.992, 'lng': 84.842, 'alert': 'NORMAL',    'travellers': 3102, 'country': 'Nepal',    'personnel': 190, 'incidents': 1},
    {'name': 'Moreh ICP',         'lat': 24.260, 'lng': 94.270, 'alert': 'HIGH',      'travellers':  904, 'country': 'Myanmar',  'personnel': 160, 'incidents': 9},
]

AIRPORTS = [
    {'name': 'IGI Delhi',        'lat': 28.556, 'lng': 77.100, 'travellers': 9842, 'cargo_cr': 284},
    {'name': 'Mumbai Airport',   'lat': 19.090, 'lng': 72.866, 'travellers': 8210, 'cargo_cr': 412},
    {'name': 'Chennai Airport',  'lat': 12.994, 'lng': 80.171, 'travellers': 3420, 'cargo_cr': 98},
    {'name': 'Kempegowda Intl.', 'lat': 13.199, 'lng': 77.707, 'travellers': 3180, 'cargo_cr': 86},
    {'name': 'Rajiv Gandhi Intl','lat': 17.240, 'lng': 78.430, 'travellers': 2940, 'cargo_cr': 72},
]

SEAPORTS = [
    {'name': 'Mumbai Port',      'lat': 18.950, 'lng': 72.843, 'cargo_cr': 1840, 'ships': 380},
    {'name': 'JNPT',             'lat': 18.949, 'lng': 72.936, 'cargo_cr': 2240, 'ships': 620},
    {'name': 'Chennai Port',     'lat': 13.083, 'lng': 80.292, 'cargo_cr':  920, 'ships': 280},
    {'name': 'Kochi Port',       'lat':  9.931, 'lng': 76.267, 'cargo_cr':  680, 'ships': 210},
    {'name': 'Kolkata Port',     'lat': 22.067, 'lng': 88.067, 'cargo_cr':  480, 'ships': 190},
]

DRONE_ZONES = [
    {'lat': 32.0, 'lng': 74.8, 'r_deg': 0.9, 'name': 'Punjab–J&K Grid',   'uavs': 4, 'hours': 18, 'status': 'ACTIVE'},
    {'lat': 27.0, 'lng': 71.0, 'r_deg': 0.8, 'name': 'Rajasthan Watch',    'uavs': 3, 'hours': 12, 'status': 'ACTIVE'},
    {'lat': 23.5, 'lng': 89.0, 'r_deg': 0.7, 'name': 'WB–BGD Corridor',   'uavs': 3, 'hours': 14, 'status': 'ACTIVE'},
    {'lat': 24.5, 'lng': 94.5, 'r_deg': 0.6, 'name': 'Manipur High-Risk', 'uavs': 2, 'hours': 10, 'status': 'ACTIVE'},
    {'lat': 27.5, 'lng': 88.8, 'r_deg': 0.5, 'name': 'Sikkim–China',      'uavs': 2, 'hours':  8, 'status': 'STANDBY'},
    {'lat': 34.0, 'lng': 74.5, 'r_deg': 0.6, 'name': 'J&K Northern Grid', 'uavs': 5, 'hours': 20, 'status': 'ACTIVE'},
]

IR_CAMERAS = [
    (32.5, 74.9), (31.8, 74.6), (31.1, 74.5), (30.4, 74.4),
    (29.7, 73.9), (29.0, 72.5), (23.2, 88.9), (23.5, 89.2),
    (24.0, 89.0), (24.2, 94.1), (27.1, 88.5), (33.5, 74.2),
    (25.0, 89.8), (26.2, 91.0), (28.5, 71.0),
]

BORDER_FENCING = [
    {
        'name': 'India–Pakistan (J&K–Punjab)',
        'coords': [(73.9, 34.5),(73.8, 33.5),(74.0, 32.5),(74.4, 31.8),(74.5, 31.2),(74.4, 30.6),(73.5, 30.0)],
        'color': '#F9A825', 'status': 'Fully Fenced', 'km': 553,
        'refugees_month': 42, 'travelers_month': 8240, 'incidents': 12,
    },
    {
        'name': 'India–Pakistan (Rajasthan)',
        'coords': [(73.5, 30.0),(72.8, 29.4),(71.9, 28.7),(71.2, 28.0),(70.5, 27.3),(70.2, 26.6)],
        'color': '#F9A825', 'status': 'Fully Fenced', 'km': 1037,
        'refugees_month': 11, 'travelers_month': 2100, 'incidents': 3,
    },
    {
        'name': 'India–Bangladesh (West Bengal)',
        'coords': [(88.5, 24.5),(88.7, 23.8),(88.9, 23.2),(89.1, 22.7),(89.3, 22.2),(89.6, 21.9)],
        'color': '#4ade80', 'status': 'Partially Fenced', 'km': 2216,
        'refugees_month': 84, 'travelers_month': 5621, 'incidents': 4,
    },
    {
        'name': 'India–Bangladesh (Assam)',
        'coords': [(88.5, 24.5),(89.5, 25.0),(90.5, 25.5),(91.5, 26.0),(92.0, 26.3)],
        'color': '#4ade80', 'status': 'Under Construction', 'km': 925,
        'refugees_month': 23, 'travelers_month': 1200, 'incidents': 2,
    },
    {
        'name': 'India–China (LAC Ladakh)',
        'coords': [(78.0, 35.5),(79.5, 34.8),(80.2, 34.2),(79.5, 33.5)],
        'color': '#ef4444', 'status': 'Disputed/Patrolled', 'km': 1597,
        'refugees_month': 0, 'travelers_month': 412, 'incidents': 21,
    },
    {
        'name': 'India–Myanmar',
        'coords': [(97.5, 27.0),(96.5, 26.0),(95.8, 25.2),(95.0, 24.5),(94.0, 23.5)],
        'color': '#fb923c', 'status': 'Partially Fenced', 'km': 1643,
        'refugees_month': 156, 'travelers_month': 904, 'incidents': 17,
    },
]

RIVERS = [
    {'name': 'Ganga',       'coords': [(79.1,25.5),(80.5,25.2),(82.0,25.3),(83.5,25.4),(85.0,25.3),(87.0,24.5),(88.0,23.9)], 'color': '#60a5fa'},
    {'name': 'Brahmaputra', 'coords': [(92.0,27.5),(91.5,26.5),(90.5,26.2),(89.5,25.8),(88.5,25.2)], 'color': '#38bdf8'},
    {'name': 'Indus',       'coords': [(76.0,34.5),(75.5,33.8),(74.8,32.5),(73.5,29.5),(72.0,24.5)], 'color': '#7dd3fc'},
    {'name': 'Yamuna',      'coords': [(77.2,30.5),(77.2,28.5),(77.3,27.5),(78.5,25.5),(79.1,25.5)], 'color': '#93c5fd'},
    {'name': 'Narmada',     'coords': [(74.5,22.5),(76.0,22.5),(78.0,22.5),(79.5,22.5),(80.2,22.2)], 'color': '#60a5fa'},
    {'name': 'Krishna',     'coords': [(75.5,16.2),(76.5,16.4),(77.5,16.2),(78.5,16.5),(79.5,16.3),(80.5,15.8)], 'color': '#38bdf8'},
    {'name': 'Godavari',    'coords': [(73.5,20.0),(75.0,19.5),(77.0,19.0),(78.5,18.5),(80.0,17.5),(81.5,16.8),(82.5,16.5)], 'color': '#7dd3fc'},
]

CITIES = [
    {'name': 'New Delhi',  'lat': 28.70, 'lng': 77.10, 'pop': 3.2, 'capital': True},
    {'name': 'Mumbai',     'lat': 19.08, 'lng': 72.88, 'pop': 2.1},
    {'name': 'Kolkata',    'lat': 22.57, 'lng': 88.36, 'pop': 1.5},
    {'name': 'Chennai',    'lat': 13.08, 'lng': 80.27, 'pop': 1.2},
    {'name': 'Bengaluru',  'lat': 12.97, 'lng': 77.59, 'pop': 1.4},
    {'name': 'Hyderabad',  'lat': 17.39, 'lng': 78.49, 'pop': 1.0},
    {'name': 'Ahmedabad',  'lat': 23.03, 'lng': 72.59, 'pop': 0.8},
    {'name': 'Pune',       'lat': 18.52, 'lng': 73.86, 'pop': 0.7},
    {'name': 'Jaipur',     'lat': 26.91, 'lng': 75.79, 'pop': 0.5},
    {'name': 'Lucknow',    'lat': 26.85, 'lng': 80.95, 'pop': 0.5},
    {'name': 'Chandigarh', 'lat': 30.74, 'lng': 76.79, 'pop': 0.3},
    {'name': 'Guwahati',   'lat': 26.14, 'lng': 91.74, 'pop': 0.3},
    {'name': 'Bhopal',     'lat': 23.26, 'lng': 77.41, 'pop': 0.3},
    {'name': 'Kochi',      'lat':  9.94, 'lng': 76.27, 'pop': 0.3},
    {'name': 'Amritsar',   'lat': 31.63, 'lng': 74.87, 'pop': 0.2},
]

ALERT_COLOR = {'HIGH': '#ef4444', 'ELEVATED': '#F9A825', 'NORMAL': '#22c55e'}

# ── PLOT ─────────────────────────────────────────────────────────────────────

def build_map():
    fig, ax = plt.subplots(1, 1, figsize=(18, 20))
    fig.patch.set_facecolor('#040c16')
    ax.set_facecolor('#060e1c')

    ax.set_xlim(64, 100)
    ax.set_ylim(6, 38)
    ax.set_aspect('equal')
    ax.tick_params(colors='#334155', labelsize=7)
    ax.spines[:].set_color('#1e293b')

    # Grid
    ax.grid(True, color='#0f172a', linewidth=0.4, alpha=0.8, zorder=0)

    # ── Rough India outline (simplified polygon) ──
    india_outline = [
        (68.0, 23.0),(67.5, 24.5),(68.5, 25.5),(70.0, 27.5),(70.2, 26.6),
        (70.5, 27.3),(71.2, 28.0),(71.9, 28.7),(72.8, 29.4),(73.5, 30.0),
        (74.4, 30.6),(74.5, 31.2),(74.4, 31.8),(74.0, 32.5),(73.8, 33.5),
        (73.9, 34.5),(75.0, 35.5),(76.5, 35.0),(78.0, 35.5),(79.5, 34.8),
        (80.2, 34.2),(80.5, 33.5),(81.5, 30.0),(82.0, 28.0),(83.0, 27.5),
        (84.0, 27.0),(84.8, 27.5),(85.5, 27.5),(86.5, 27.5),(87.0, 27.0),
        (87.5, 26.5),(88.0, 26.0),(88.5, 24.5),(88.7, 23.8),(88.9, 23.2),
        (89.1, 22.7),(89.3, 22.2),(89.6, 21.9),(90.5, 22.5),(91.5, 23.5),
        (92.0, 23.0),(92.5, 23.0),(93.5, 24.5),(94.0, 23.5),(95.0, 24.5),
        (95.8, 25.2),(96.5, 26.0),(97.5, 27.0),(97.2, 28.0),(95.5, 29.0),
        (92.5, 27.0),(91.5, 26.5),(90.5, 26.2),(89.5, 26.0),(89.0, 25.0),
        (88.5, 24.5),(88.0, 24.0),(87.5, 23.0),(87.0, 22.0),(86.0, 20.5),
        (85.5, 19.5),(85.0, 18.5),(84.0, 18.0),(82.0, 16.0),(81.0, 15.0),
        (80.0, 14.0),(78.5, 11.5),(77.5, 10.5),(77.0, 9.5),(76.5, 9.0),
        (76.0, 8.5),(77.0, 8.0),(77.5, 8.3),(78.0, 8.5),(79.0, 9.5),
        (80.0, 10.0),(80.5, 10.5),(80.0, 11.0),(79.5, 11.5),(78.5, 12.5),
        (77.5, 13.5),(76.5, 14.0),(76.0, 15.0),(75.0, 15.5),(74.5, 16.0),
        (73.5, 17.0),(73.0, 18.0),(72.5, 18.5),(72.0, 19.0),(72.0, 20.0),
        (72.5, 21.5),(71.5, 22.5),(70.5, 22.8),(70.0, 22.5),(69.0, 22.0),
        (68.0, 23.0),
    ]
    poly_x = [p[0] for p in india_outline]
    poly_y = [p[1] for p in india_outline]
    ax.fill(poly_x, poly_y, color='#0f1e36', alpha=0.8, zorder=1)
    ax.plot(poly_x, poly_y, color='#1e3a5f', linewidth=0.6, alpha=0.6, zorder=2)

    # ── Drone zones ──
    for dz in DRONE_ZONES:
        c_color = '#22c55e' if dz['status'] == 'ACTIVE' else '#F9A825'
        circle = plt.Circle((dz['lng'], dz['lat']), dz['r_deg'],
                             color=c_color, alpha=0.06, linewidth=1.2,
                             linestyle='--', fill=True, zorder=3)
        ax.add_patch(circle)
        border = plt.Circle((dz['lng'], dz['lat']), dz['r_deg'],
                             color=c_color, alpha=0.35, linewidth=1.0,
                             linestyle='--', fill=False, zorder=3)
        ax.add_patch(border)
        ax.text(dz['lng'], dz['lat'] + dz['r_deg'] + 0.1,
                f"🚁 {dz['name']}\n{dz['uavs']} UAVs · {dz['status']}",
                fontsize=5.5, color=c_color, ha='center', va='bottom',
                fontweight='bold', zorder=10, alpha=0.85)

    # ── Rivers ──
    for river in RIVERS:
        rx = [c[0] for c in river['coords']]
        ry = [c[1] for c in river['coords']]
        ax.plot(rx, ry, color=river['color'], linewidth=1.4, alpha=0.45, zorder=4,
                path_effects=[pe.Stroke(linewidth=2.5, foreground='#0a1628', alpha=0.6), pe.Normal()])
        mid = len(rx) // 2
        ax.text(rx[mid], ry[mid] + 0.2, river['name'],
                fontsize=6, color=river['color'], ha='center', alpha=0.7, style='italic', zorder=10)

    # ── Border fencing ──
    for seg in BORDER_FENCING:
        fx = [c[0] for c in seg['coords']]
        fy = [c[1] for c in seg['coords']]
        ls = '--' if seg['status'] == 'Under Construction' else '-'
        alpha = 0.6 if 'Disputed' in seg['status'] else 0.9
        ax.plot(fx, fy, color=seg['color'], linewidth=3.5, alpha=alpha,
                linestyle=ls, zorder=6,
                path_effects=[pe.Stroke(linewidth=6, foreground='black', alpha=0.4), pe.Normal()])
        # Label mid segment
        mid = len(fx) // 2
        ax.text(fx[mid], fy[mid] + 0.25,
                f"{seg['name']}\n{seg['km']} km · {seg['status']}",
                fontsize=5.5, color=seg['color'], ha='center', fontweight='bold',
                alpha=0.85, zorder=11,
                bbox=dict(boxstyle='round,pad=0.15', facecolor='#040c16', alpha=0.5, edgecolor=seg['color'], linewidth=0.5))

    # ── IR Cameras ──
    for cam in IR_CAMERAS:
        ax.plot(cam[1], cam[0], 'o', markersize=5, color='#ea580c', zorder=8, alpha=0.9,
                markeredgecolor='#fed7aa', markeredgewidth=0.5)
        glow = plt.Circle((cam[1], cam[0]), 0.08, color='#ea580c', alpha=0.15, zorder=7)
        ax.add_patch(glow)

    # ── Seaports ──
    for sp in SEAPORTS:
        ax.plot(sp['lng'], sp['lat'], 's', markersize=8, color='#0e7490', zorder=9,
                markeredgecolor='#67e8f9', markeredgewidth=1.0)
        ax.text(sp['lng'] + 0.3, sp['lat'],
                f"⚓ {sp['name']}\n₹{sp['cargo_cr']} Cr",
                fontsize=6, color='#67e8f9', va='center', zorder=12, fontweight='bold')

    # ── Airports ──
    for ap in AIRPORTS:
        ax.plot(ap['lng'], ap['lat'], '^', markersize=9, color='#1d4ed8', zorder=9,
                markeredgecolor='#93c5fd', markeredgewidth=1.0)
        ax.text(ap['lng'] + 0.3, ap['lat'],
                f"✈ {ap['name']}\n{ap['travellers']:,} pax/day",
                fontsize=6, color='#93c5fd', va='center', zorder=12, fontweight='bold')

    # ── Land ICPs ──
    for icp in LAND_ICPS:
        color = ALERT_COLOR.get(icp['alert'], '#22c55e')
        ax.plot(icp['lng'], icp['lat'], 'o', markersize=11, color=color, zorder=10,
                markeredgecolor='white', markeredgewidth=1.5,
                path_effects=[pe.Stroke(linewidth=4, foreground=color, alpha=0.3), pe.Normal()])
        ax.text(icp['lng'] + 0.3, icp['lat'],
                f"🛂 {icp['name']}\n{icp['alert']} · {icp['travellers']:,}/day\n{icp['incidents']} incidents/mo",
                fontsize=6.5, color=color, va='center', fontweight='bold', zorder=13,
                bbox=dict(boxstyle='round,pad=0.2', facecolor='#040c16', alpha=0.7, edgecolor=color, linewidth=0.7))

    # ── Cities ──
    for city in CITIES:
        if city.get('capital'):
            ax.plot(city['lng'], city['lat'], '*', markersize=16, color='#fbbf24', zorder=11,
                    markeredgecolor='#92400e', markeredgewidth=0.8)
            ax.text(city['lng'] + 0.25, city['lat'] + 0.35,
                    f"★ {city['name']}\n(Capital)",
                    fontsize=8, color='#fbbf24', fontweight='bold', zorder=13)
        else:
            size = 5 + city.get('pop', 0.3) * 2
            ax.plot(city['lng'], city['lat'], 'o', markersize=size, color='#f1f5f9', zorder=9,
                    alpha=0.7, markeredgecolor='#475569', markeredgewidth=0.5)
            ax.text(city['lng'] + 0.15, city['lat'] + 0.15,
                    city['name'], fontsize=6, color='rgba(255,255,255,0.7)',
                    alpha=0.8, zorder=12)

    # ── Title & Labels ──
    ax.set_title(
        'SeemaSetu — India Strategic Border Intelligence Map (2026)\n'
        'Ministry of Home Affairs · Border Security Force · IBMS v2.0',
        color='white', fontsize=13, fontweight='bold', pad=14,
        bbox=dict(boxstyle='round', facecolor='#0f172a', edgecolor='#FF9933', linewidth=1.5)
    )

    ax.set_xlabel('Longitude (°E)', color='#475569', fontsize=8)
    ax.set_ylabel('Latitude (°N)',  color='#475569', fontsize=8)
    ax.tick_params(colors='#475569', labelsize=7)

    # ── Legend ──
    legend_items = [
        Line2D([0],[0], color='#F9A825', linewidth=3, label='Border Fencing (Pakistan)'),
        Line2D([0],[0], color='#4ade80', linewidth=3, label='Border Fencing (Bangladesh)'),
        Line2D([0],[0], color='#ef4444', linewidth=3, linestyle='--', label='Disputed/Patrolled Border'),
        Line2D([0],[0], color='#fb923c', linewidth=3, linestyle='--', label='Border Fencing (Myanmar)'),
        Line2D([0],[0], marker='o',  color='#ef4444', markersize=8, linewidth=0, label='ICP — HIGH Alert'),
        Line2D([0],[0], marker='o',  color='#F9A825', markersize=8, linewidth=0, label='ICP — ELEVATED Alert'),
        Line2D([0],[0], marker='o',  color='#22c55e', markersize=8, linewidth=0, label='ICP — NORMAL'),
        Line2D([0],[0], marker='^',  color='#1d4ed8', markersize=8, linewidth=0, label='International Airport'),
        Line2D([0],[0], marker='s',  color='#0e7490', markersize=8, linewidth=0, label='Major Seaport'),
        Line2D([0],[0], marker='o',  color='#ea580c', markersize=6, linewidth=0, label='IR Camera Post'),
        Line2D([0],[0], marker='o',  color='#22c55e', markersize=8, linewidth=0, alpha=0.3, label='Drone Surveillance Zone'),
        Line2D([0],[0], marker='*',  color='#fbbf24', markersize=11, linewidth=0, label='National Capital'),
        Line2D([0],[0], color='#60a5fa', linewidth=1.5, label='Major Rivers'),
    ]
    legend = ax.legend(handles=legend_items, loc='lower left', fontsize=6.5,
                       facecolor='#0f172a', edgecolor='#1e3a5f', labelcolor='white',
                       framealpha=0.92, title='LEGEND', title_fontsize=7)
    legend.get_title().set_color('#FF9933')

    # ── Stats infobox ──
    stats_text = (
        "INDIA BORDER STATISTICS 2026\n"
        "─────────────────────────────\n"
        "Total Land Border:  15,106 km\n"
        "Coastline:           7,516 km\n"
        "Bordering Nations:   7 countries\n"
        "Active ICPs:         14\n"
        "Border Fencing (Pak): 2,289 km\n"
        "Border Fencing (BGD): 3,141 km\n"
        "Monthly Travellers:  12.84 Lakh\n"
        "Monthly Trade:       ₹98,400 Cr\n"
        "Active Drone Units:  19\n"
        "IR Camera Posts:     15"
    )
    ax.text(0.99, 0.98, stats_text,
            transform=ax.transAxes, fontsize=6.5, verticalalignment='top',
            horizontalalignment='right', color='white', fontfamily='monospace',
            bbox=dict(boxstyle='round', facecolor='#0f172a', alpha=0.88, edgecolor='#FF9933', linewidth=1.2))

    # ── Timestamp ──
    from datetime import datetime
    ax.text(0.01, 0.01,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M IST')} · RESTRICTED — AUTHORISED PERSONNEL ONLY",
            transform=ax.transAxes, fontsize=6, color='#475569', va='bottom')

    plt.tight_layout(pad=1.5)
    return fig


def save_map(fig, filename='india_border_intelligence_map.png'):
    fig.savefig(filename, dpi=180, bbox_inches='tight',
                facecolor=fig.get_facecolor(), edgecolor='none')
    print(f"✅  Map saved: {filename}")


def generate_interactive_html():
    """Generate an interactive Plotly version."""
    try:
        import plotly.graph_objects as go
        fig = go.Figure()

        # Background
        fig.update_layout(
            paper_bgcolor='#040c16',
            plot_bgcolor='#060e1c',
            font=dict(family='Inter, system-ui', color='white'),
            title=dict(
                text='SeemaSetu — India Border Intelligence Map (2026)',
                font=dict(size=16, color='#FF9933')
            ),
            xaxis=dict(range=[64, 100], title='Longitude', color='#475569', gridcolor='#0f172a'),
            yaxis=dict(range=[6, 38],   title='Latitude',  color='#475569', gridcolor='#0f172a'),
            width=1400, height=900,
        )

        # Border fencing
        for seg in BORDER_FENCING:
            fx = [c[0] for c in seg['coords']]
            fy = [c[1] for c in seg['coords']]
            fig.add_trace(go.Scatter(
                x=fx, y=fy, mode='lines',
                line=dict(color=seg['color'], width=3,
                          dash='dash' if 'Construction' in seg['status'] or 'Disputed' in seg['status'] else 'solid'),
                name=seg['name'],
                hovertemplate=(
                    f"<b>{seg['name']}</b><br>"
                    f"Length: {seg['km']} km<br>"
                    f"Status: {seg['status']}<br>"
                    f"Refugees this month: {seg['refugees_month']}<br>"
                    f"Travellers this month: {seg['travelers_month']:,}<br>"
                    f"Incidents: {seg['incidents']}<extra></extra>"
                )
            ))

        # Rivers
        for river in RIVERS:
            rx = [c[0] for c in river['coords']]
            ry = [c[1] for c in river['coords']]
            fig.add_trace(go.Scatter(
                x=rx, y=ry, mode='lines',
                line=dict(color=river['color'], width=1.5),
                name=f"River: {river['name']}", opacity=0.5,
                hovertemplate=f"<b>{river['name']}</b><extra></extra>"
            ))

        # Drone zones
        for dz in DRONE_ZONES:
            theta = np.linspace(0, 2*np.pi, 60)
            cx = dz['lng'] + dz['r_deg'] * np.cos(theta)
            cy = dz['lat'] + dz['r_deg'] * np.sin(theta)
            color = '#22c55e' if dz['status'] == 'ACTIVE' else '#F9A825'
            fig.add_trace(go.Scatter(
                x=cx, y=cy, mode='lines', fill='toself',
                fillcolor=f"rgba(34,197,94,0.06)",
                line=dict(color=color, width=1, dash='dot'),
                name=f"Drone Zone: {dz['name']}",
                hovertemplate=(
                    f"<b>{dz['name']}</b><br>"
                    f"UAVs: {dz['uavs']}<br>"
                    f"Coverage: {dz['hours']}h/day<br>"
                    f"Status: {dz['status']}<extra></extra>"
                )
            ))

        # IR Cameras
        fig.add_trace(go.Scatter(
            x=[c[1] for c in IR_CAMERAS],
            y=[c[0] for c in IR_CAMERAS],
            mode='markers', name='IR Camera Posts',
            marker=dict(color='#ea580c', size=8, symbol='circle',
                        line=dict(color='#fed7aa', width=1)),
            hovertemplate='<b>IR Camera Post</b><br>Location: (%{y:.2f}°N, %{x:.2f}°E)<extra></extra>'
        ))

        # Seaports
        fig.add_trace(go.Scatter(
            x=[s['lng'] for s in SEAPORTS],
            y=[s['lat'] for s in SEAPORTS],
            mode='markers+text', name='Seaports',
            text=[s['name'] for s in SEAPORTS],
            textposition='middle right', textfont=dict(size=9, color='#67e8f9'),
            marker=dict(color='#0e7490', size=12, symbol='square',
                        line=dict(color='#67e8f9', width=1.5)),
            hovertemplate='<b>%{text}</b><br>Cargo: ₹%{customdata[0]} Cr/day<br>Ships: %{customdata[1]}/month<extra></extra>',
            customdata=[[s['cargo_cr'], s['ships']] for s in SEAPORTS],
        ))

        # Airports
        fig.add_trace(go.Scatter(
            x=[a['lng'] for a in AIRPORTS],
            y=[a['lat'] for a in AIRPORTS],
            mode='markers+text', name='Airports',
            text=[a['name'] for a in AIRPORTS],
            textposition='middle right', textfont=dict(size=9, color='#93c5fd'),
            marker=dict(color='#1d4ed8', size=13, symbol='triangle-up',
                        line=dict(color='#93c5fd', width=1.5)),
            hovertemplate='<b>%{text}</b><br>Travellers: %{customdata[0]:,}/day<br>Cargo: ₹%{customdata[1]} Cr/day<extra></extra>',
            customdata=[[a['travellers'], a['cargo_cr']] for a in AIRPORTS],
        ))

        # Land ICPs
        for icp in LAND_ICPS:
            color = ALERT_COLOR.get(icp['alert'], '#22c55e')
            fig.add_trace(go.Scatter(
                x=[icp['lng']], y=[icp['lat']],
                mode='markers+text', name=f"ICP: {icp['name']}",
                text=[icp['name']],
                textposition='middle right', textfont=dict(size=9, color=color),
                marker=dict(color=color, size=14, symbol='circle',
                            line=dict(color='white', width=2)),
                hovertemplate=(
                    f"<b>{icp['name']}</b><br>"
                    f"Alert: {icp['alert']}<br>"
                    f"Border with: {icp['country']}<br>"
                    f"Travellers: {icp['travellers']:,}/day<br>"
                    f"Personnel: {icp['personnel']}<br>"
                    f"Incidents/month: {icp['incidents']}<extra></extra>"
                )
            ))

        # Cities
        cap = [c for c in CITIES if c.get('capital')]
        cities = [c for c in CITIES if not c.get('capital')]
        fig.add_trace(go.Scatter(
            x=[c['lng'] for c in cities], y=[c['lat'] for c in cities],
            mode='markers+text', name='Major Cities',
            text=[c['name'] for c in cities],
            textposition='middle right', textfont=dict(size=8, color='rgba(255,255,255,0.7)'),
            marker=dict(color='#f1f5f9', size=7, opacity=0.7),
            hovertemplate='<b>%{text}</b><extra></extra>'
        ))
        fig.add_trace(go.Scatter(
            x=[c['lng'] for c in cap], y=[c['lat'] for c in cap],
            mode='markers+text', name='National Capital',
            text=[c['name'] for c in cap],
            textposition='middle right', textfont=dict(size=11, color='#fbbf24'),
            marker=dict(color='#fbbf24', size=18, symbol='star',
                        line=dict(color='#92400e', width=1)),
            hovertemplate='<b>%{text}</b><br>National Capital of India<extra></extra>'
        ))

        html_file = 'india_border_map_interactive.html'
        fig.write_html(html_file, include_plotlyjs='cdn')
        print(f"✅  Interactive map saved: {html_file}")
        return True
    except ImportError:
        print("⚠  plotly not installed — skipping interactive HTML. Install with: pip install plotly")
        return False


if __name__ == '__main__':
    print("\n🗺️  SeemaSetu — India Border Intelligence Map Generator")
    print("=" * 55)
    print("Generating static matplotlib map...")
    fig = build_map()
    save_map(fig)
    plt.close(fig)

    print("\nGenerating interactive Plotly map...")
    generate_interactive_html()

    print("\n✅  Done! Files generated:")
    print("   📄 india_border_intelligence_map.png  (static, 180 DPI)")
    print("   🌐 india_border_map_interactive.html  (interactive)")
    print("\nOpen india_border_map_interactive.html in a browser for clickable markers.")
