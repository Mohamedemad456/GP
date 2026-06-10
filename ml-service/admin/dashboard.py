"""
KARNA ML Admin Dashboard
==========================
Streamlit internal UI for model registry management.
Calls FastAPI admin endpoints at http://localhost:8001/admin/...
"""
from __future__ import annotations

import os
from datetime import datetime

import pandas as pd
import requests
import streamlit as st

# ── Configuration ────────────────────────────────────────────────
API_BASE = os.environ.get("ADMIN_API_BASE", "http://localhost:8001/admin")

# ── Theme colors ─────────────────────────────────────────────────
PRIMARY = "#1D6159"
PRIMARY_LIGHT = "#2A8F80"
BG = "#FAF6F0"
TEXT = "#363636"
TEXT_LIGHT = "#666666"
WHITE = "#FFFFFF"
BORDER = "#E0DDD5"
ERROR = "#C0392B"
SUCCESS = "#27AE60"
WARNING = "#E67E22"

# ── Page setup ──────────────────────────────────────────────────
st.set_page_config(
    page_title="KARNA ML Admin",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ──────────────────────────────────────────────────
_CUSTOM_CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
html, body, [class*="st-"] {{ font-family: 'Inter', sans-serif !important; }}
.stApp {{ background-color: {BG} !important; }}
h1, h2, h3, h4, h5, h6 {{ color: {TEXT} !important; font-weight: 600 !important; }}
.stSidebar {{ background-color: {WHITE} !important; border-right: 1px solid {BORDER}; }}
.stButton > button {{
    background-color: {PRIMARY} !important;
    color: {WHITE} !important;
    border-radius: 8px !important;
    border: none !important;
    font-weight: 500 !important;
    padding: 0.5rem 1.25rem !important;
    transition: all 0.2s ease !important;
}}
.stButton > button:hover {{
    background-color: {PRIMARY_LIGHT} !important;
    box-shadow: 0 2px 8px rgba(29,97,89,0.3) !important;
}}
.stTabs [data-baseweb="tab-list"] {{ border-bottom: 2px solid {BORDER} !important; }}
.stTabs [data-baseweb="tab"] {{ color: {TEXT_LIGHT} !important; font-weight: 500 !important; }}
.stTabs [aria-selected="true"] {{ color: {PRIMARY} !important; border-bottom: 2px solid {PRIMARY} !important; }}
[data-testid="stMetricValue"] {{ color: {PRIMARY} !important; font-weight: 700 !important; }}
[data-testid="stMetricLabel"] {{ color: {TEXT_LIGHT} !important; font-size: 0.85rem !important; }}
.stDataFrame {{ border: 1px solid {BORDER} !important; border-radius: 8px !important; }}
/* Sidebar radio labels always visible */
.stRadio label {{ color: {PRIMARY} !important; font-weight: 500 !important; }}
.stRadio label span {{ color: {PRIMARY} !important; }}
.stSidebar .stRadio label {{ color: {PRIMARY} !important; }}
.stSidebar .stRadio label p {{ color: {PRIMARY} !important; }}
</style>
"""
st.markdown(_CUSTOM_CSS, unsafe_allow_html=True)


def _get(path: str) -> dict | None:
    try:
        r = requests.get(f"{API_BASE}{path}", timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.ConnectionError:
        st.error(
            f"Cannot connect to API at `{API_BASE}`. "
            "Make sure the ML service is running on port 8001."
        )
        return None
    except Exception as e:
        st.error(f"API error: {e}")
        return None


def _post(path: str) -> dict | None:
    try:
        r = requests.post(f"{API_BASE}{path}", timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.HTTPError as e:
        try:
            detail = e.response.json().get("detail", str(e))
        except Exception:
            detail = str(e)
        st.error(f"API error: {detail}")
        return None
    except Exception as e:
        st.error(f"API error: {e}")
        return None


def _status_badge(stage: str) -> str:
    color = {
        "production": ("#D4EDDA", "#155724"),
        "archived": ("#F8D7DA", "#721C24"),
        "staging": ("#FFF3CD", "#856404"),
    }.get(stage, ("#E2E3E5", "#383D41"))
    return f"<span style='display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;text-transform:uppercase;background:{color[0]};color:{color[1]}'>{stage}</span>"


def _format_datetime(dt_str: str | None) -> str:
    if not dt_str:
        return "—"
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return dt_str[:16]


def _metric_card(label: str, value: str, color: str = PRIMARY, value_font_size: str = "1.8rem"):
    st.markdown(
        f"<div style='background:{WHITE};border:1px solid {BORDER};border-radius:12px;padding:1.2rem;text-align:center;'>"
        f"<div style='font-size:0.8rem;color:{TEXT_LIGHT};margin-bottom:0.3rem;'>{label}</div>"
        f"<div style='font-size:{value_font_size};font-weight:700;color:{color};word-break:break-word;'>"
        f"{value}</div></div>",
        unsafe_allow_html=True,
    )


# ── Sidebar ─────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(f"<h1 style='color:{PRIMARY};margin-bottom:0.2rem;'>🧠 KARNA</h1>", unsafe_allow_html=True)
    st.markdown(f"<p style='color:{TEXT_LIGHT};font-size:0.9rem;margin-top:0;'>ML Admin Dashboard</p>", unsafe_allow_html=True)
    st.markdown("<hr style='border-color:#E0DDD5;margin:1.5rem 0;'>", unsafe_allow_html=True)
    page = st.radio(
        "Navigate",
        ["Registry Overview", "Model Details", "Compare Models", "Activate Model", "Coverage Explorer"],
        label_visibility="collapsed",
    )
    st.markdown("<hr style='border-color:#E0DDD5;margin:1.5rem 0;'>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════
# PAGE: Registry Overview
# ════════════════════════════════════════════════════════════════

if page == "Registry Overview":
    st.title("Registry Overview")
    data = _get("/models")
    if not data:
        st.stop()
    summary = data.get("summary", {})
    models = data.get("models", [])

    cols = st.columns(4)
    with cols[0]:
        active_id = str(summary.get("active_model_id", "—"))
        active_display = active_id[:14] + "…" if len(active_id) > 14 else active_id
        _metric_card("Active Model", active_display, value_font_size="1.1rem")
    with cols[1]:
        _metric_card("Total Models", str(summary.get("total_models", 0)))
    with cols[2]:
        latest = str(summary.get("latest_candidate", "—"))
        latest_display = latest[:14] + "…" if len(latest) > 14 else latest
        _metric_card("Latest Candidate", latest_display, value_font_size="1.1rem")
    with cols[3]:
        _metric_card("Version", str(summary.get("active_version", "—")))

    st.markdown("<div style='height:1.5rem;'></div>", unsafe_allow_html=True)

    st.markdown(
        f"<div style='background:{WHITE};border:1px solid {BORDER};border-radius:12px;padding:1rem;margin-bottom:1rem;'>"
        f"<h4 style='margin-top:0;color:{PRIMARY};'>All Models ({len(models)})</h4></div>",
        unsafe_allow_html=True,
    )

    table_data = []
    for m in models:
        metrics = m.get("metrics", {})
        mape = metrics.get("MAPE_pct") or metrics.get("mape") or "—"
        mae = metrics.get("MAE") or metrics.get("mae") or "—"
        r2 = metrics.get("R2") or metrics.get("r2") or "—"
        dataset_tag = m.get("dataset_tag") or "—"
        table_data.append({
            "Model ID": m.get("model_id", "—"),
            "Version": m.get("version", "—"),
            "Framework": m.get("framework", "—"),
            "MAPE": f"{mape:.2f}%" if isinstance(mape, (int, float)) else str(mape),
            "MAE": f"{mae:,.0f}" if isinstance(mae, (int, float)) else str(mae),
            "R²": f"{r2:.3f}" if isinstance(r2, (int, float)) else str(r2),
            "Dataset": dataset_tag,
            "Registered": _format_datetime(m.get("registered_at")),
            "Active": "✅" if m.get("is_active") else "",
        })
    df = pd.DataFrame(table_data)

    def highlight_active(row):
        if row["Active"] == "✅":
            return [f"background-color: rgba(29,97,89,0.08); font-weight: 500;"] * len(row)
        return [""] * len(row)

    st.dataframe(df.style.apply(highlight_active, axis=1), use_container_width=True, hide_index=True)


# ════════════════════════════════════════════════════════════════
# PAGE: Model Details
# ════════════════════════════════════════════════════════════════

elif page == "Model Details":
    st.title("Model Details")
    data = _get("/models")
    if not data:
        st.stop()

    models_list = data.get("models", [])
    model_options = {
        m["model_id"]: f"{'✅ ' if m.get('is_active') else ''}{m['model_id']} ({m.get('version', '?')}, {m.get('stage', '?')})"
        for m in models_list
    }
    selected_id = st.selectbox("Select model", options=list(model_options.keys()), format_func=lambda x: model_options[x])
    detail = _get(f"/models/{selected_id}")
    if not detail:
        st.stop()

    stage = detail.get("stage", "unknown")
    is_active = detail.get("model_id") == data.get("summary", {}).get("active_model_id")
    dataset_tag = detail.get("dataset_tag") or "—"
    sample_counts = detail.get("sample_counts") or {}
    sample_info = ""
    if sample_counts:
        parts = []
        if "n_train" in sample_counts:
            parts.append(f"Train: {sample_counts['n_train']:,}")
        if "n_test" in sample_counts:
            parts.append(f"Test: {sample_counts['n_test']:,}")
        if "n_cal" in sample_counts:
            parts.append(f"Cal: {sample_counts['n_cal']:,}")
        if parts:
            sample_info = " | " + " · ".join(parts)
    st.markdown(
        f"<div style='background:{WHITE};border:1px solid {BORDER};border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;'>"
        f"<div style='display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;'>"
        f"<div><h2 style='margin:0;color:{PRIMARY};'>{detail.get('model_id', '—')}</h2>"
        f"<p style='margin:0.3rem 0 0 0;color:{TEXT_LIGHT};font-size:0.9rem;'>"
        f"Version: {detail.get('version', '—')} | Framework: {detail.get('framework', '—')} | Dataset: {dataset_tag}{sample_info}</p></div>"
        f"<div style='margin-top:0.5rem;'>{_status_badge(stage)}"
        f"{'&nbsp;' + _status_badge('production').replace('production', 'ACTIVE') if is_active else ''}</div></div></div>",
        unsafe_allow_html=True,
    )

    tab1, tab2 = st.tabs(["Metrics", "Diagnostics"])

    with tab1:
        metrics = detail.get("metrics", {})
        if metrics:
            cols = st.columns(min(len(metrics), 4))
            for i, (k, v) in enumerate(metrics.items()):
                with cols[i % 4]:
                    val_str = f"{v:.4f}" if isinstance(v, float) else str(v)
                    _metric_card(k, val_str)
        else:
            st.info("No metrics available for this model.")

    with tab2:
        diag = detail.get("diagnostics_summary", {})
        if diag:
            st.json(diag)
        else:
            st.info("No diagnostics summary available.")
        metadata = detail.get("metadata")
        if metadata:
            st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)
            st.markdown(f"<h5 style='color:{PRIMARY};'>Full Metadata</h5>", unsafe_allow_html=True)
            st.json(metadata)


# ════════════════════════════════════════════════════════════════
# PAGE: Compare Models
# ════════════════════════════════════════════════════════════════

elif page == "Compare Models":
    st.title("Compare Models")
    data = _get("/models")
    if not data:
        st.stop()

    models_list = data.get("models", [])
    model_options = [m["model_id"] for m in models_list]
    if len(model_options) < 2:
        st.warning("Need at least 2 models to compare.")
        st.stop()

    col1, col2 = st.columns(2)
    with col1:
        left_id = st.selectbox("Model A", model_options, index=0, key="left")
    with col2:
        right_id = st.selectbox("Model B", model_options, index=min(1, len(model_options) - 1), key="right")

    if left_id == right_id:
        st.warning("Please select two different models.")
        st.stop()

    left = _get(f"/models/{left_id}")
    right = _get(f"/models/{right_id}")
    if not left or not right:
        st.stop()

    for col, m, title in zip(st.columns(2), [left, right], [left_id, right_id]):
        with col:
            stage = m.get("stage", "unknown")
            is_active = m.get("model_id") == data.get("summary", {}).get("active_model_id")
            active_badge = (
                f'<p style="margin:0.3rem 0 0 0;color:{PRIMARY};font-size:0.8rem;font-weight:600;">CURRENTLY ACTIVE</p>'
                if is_active else ''
            )
            st.markdown(
                f"<div style='background:{WHITE};border:1px solid {BORDER};border-radius:12px;padding:1.2rem;'>"
                f"<div style='display:flex;justify-content:space-between;align-items:center;'>"
                f"<h3 style='margin:0;color:{PRIMARY};'>{m.get('model_id')}</h3><div>{_status_badge(stage)}</div></div>"
                f"<p style='margin:0.3rem 0 0 0;color:{TEXT_LIGHT};font-size:0.85rem;'>"
                f"v{m.get('version', '?')} | {m.get('framework', '?')} | {_format_datetime(m.get('registered_at'))}</p>"
                f"{active_badge}"
                f"</div>",
                unsafe_allow_html=True,
            )

    st.markdown("<div style='height:1.5rem;'></div>", unsafe_allow_html=True)

    st.markdown(f"<h4 style='color:{PRIMARY};'>Metrics Comparison</h4>", unsafe_allow_html=True)
    all_keys = set(left.get("metrics", {}).keys()) | set(right.get("metrics", {}).keys())
    if all_keys:
        comp_data = []
        for k in sorted(all_keys):
            lv = left.get("metrics", {}).get(k, "—")
            rv = right.get("metrics", {}).get(k, "—")
            comp_data.append({
                "Metric": k,
                left_id: f"{lv:.4f}" if isinstance(lv, float) else str(lv),
                right_id: f"{rv:.4f}" if isinstance(rv, float) else str(rv),
            })
        st.dataframe(pd.DataFrame(comp_data), use_container_width=True, hide_index=True)
    else:
        st.info("No metrics to compare.")

    st.markdown(f"<h4 style='color:{PRIMARY};margin-top:1.5rem;'>Coverage Comparison</h4>", unsafe_allow_html=True)
    for col, m, title in zip(st.columns(2), [left, right], [left_id, right_id]):
        with col:
            cov = m.get("coverage", {})
            st.markdown(
                f"<div style='background:{WHITE};border:1px solid {BORDER};border-radius:12px;padding:1rem;text-align:center;'>"
                f"<div style='font-size:0.8rem;color:{TEXT_LIGHT};margin-bottom:0.3rem;'>{title}</div>"
                f"<div style='font-size:1.5rem;font-weight:700;color:{PRIMARY};'>{cov.get('combo_count', 0)} combos</div>"
                f"<div style='font-size:0.75rem;color:{TEXT_LIGHT};margin-top:0.2rem;'>{cov.get('make_count', 0)} makes / {len(cov.get('models', []))} models</div></div>",
                unsafe_allow_html=True,
            )

    st.markdown(f"<h4 style='color:{PRIMARY};margin-top:1.5rem;'>Diagnostics Summary</h4>", unsafe_allow_html=True)
    for col, m, title in zip(st.columns(2), [left, right], [left_id, right_id]):
        with col:
            st.markdown(f"<h5 style='color:{TEXT_LIGHT};font-size:0.9rem;'>{title}</h5>", unsafe_allow_html=True)
            diag = m.get("diagnostics_summary", {})
            if diag:
                st.json(diag)
            else:
                st.info("No diagnostics.")


# ════════════════════════════════════════════════════════════════
# PAGE: Activate Model
# ════════════════════════════════════════════════════════════════

elif page == "Activate Model":
    st.title("Activate Model")
    data = _get("/models")
    if not data:
        st.stop()

    summary = data.get("summary", {})
    active_id = summary.get("active_model_id")
    models_list = data.get("models", [])

    st.markdown(
        f"<div style='background:{WHITE};border:1px solid {BORDER};border-radius:12px;padding:1.5rem;margin-bottom:2rem;'>"
        f"<h3 style='margin-top:0;color:{PRIMARY};'>Currently Active</h3>"
        f"<p style='font-size:1.2rem;font-weight:600;color:{TEXT};margin:0.5rem 0;'>{active_id or 'None'}</p>"
        f"<p style='color:{TEXT_LIGHT};font-size:0.85rem;margin:0;'>Version: {summary.get('active_version', '—')} | Promoted: {_format_datetime(summary.get('promoted_at'))}</p></div>",
        unsafe_allow_html=True,
    )

    st.markdown(f"<h3 style='color:{PRIMARY};'>Select Model to Activate</h3>", unsafe_allow_html=True)
    candidates = [m for m in models_list if m["model_id"] != active_id]
    if not candidates:
        st.info("No other models available for activation.")
        st.stop()

    options = {m["model_id"]: f"{m['model_id']} (v{m.get('version', '?')}, {m.get('framework', '?')})" for m in candidates}
    selected = st.selectbox("Choose a model", options=list(options.keys()), format_func=lambda x: options[x])

    detail = _get(f"/models/{selected}")
    if detail:
        st.markdown(
            f"<div style='background:{WHITE};border:1px solid {BORDER};border-radius:12px;padding:1.2rem;'>"
            f"<h4 style='margin-top:0;color:{PRIMARY};'>Preview: {selected}</h4>"
            f"<p style='margin:0.2rem 0;color:{TEXT_LIGHT};font-size:0.9rem;'>"
            f"Stage: <b>{detail.get('stage', '—')}</b> | Framework: <b>{detail.get('framework', '—')}</b> | Coverage: <b>{detail.get('coverage', {}).get('combo_count', 0)} combos</b></p></div>",
            unsafe_allow_html=True,
        )

    st.markdown("<div style='height:1.5rem;'></div>", unsafe_allow_html=True)
    st.markdown(
        f"<div style='background:rgba(192,57,43,0.05);border:1px solid {ERROR};border-radius:12px;padding:1.2rem;'>"
        f"<h4 style='margin-top:0;color:{ERROR};'>⚠️ Confirm Activation</h4>"
        f"<p style='color:{TEXT};margin:0;font-size:0.9rem;'>"
        f"This will replace the active model <b>{active_id}</b> with <b>{selected}</b>. "
        f"The new model will be loaded in memory immediately.</p></div>",
        unsafe_allow_html=True,
    )

    # Show persisted success message after a rerun
    if st.session_state.get("activation_success"):
        result = st.session_state.pop("activation_success")
        st.success(result.get("message", "Activation successful."))
        st.markdown(
            f"<div style='background:rgba(39,174,96,0.05);border:1px solid {SUCCESS};border-radius:8px;padding:1rem;margin-top:1rem;'>"
            f"<p style='margin:0;color:{TEXT};font-size:0.9rem;'>"
            f"<b>Activated:</b> {result.get('activated_model_id')}<br>"
            f"<b>Previous:</b> {result.get('previous_model_id')}</p></div>",
            unsafe_allow_html=True,
        )
        st.balloons()

    st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)
    if st.button("Activate Model", type="primary"):
        with st.spinner("Activating..."):
            result = _post(f"/models/{selected}/activate")
        if result:
            st.session_state["activation_success"] = result
            st.rerun()


# ════════════════════════════════════════════════════════════════
# PAGE: Coverage Explorer
# ════════════════════════════════════════════════════════════════

elif page == "Coverage Explorer":
    st.title("Coverage Explorer")
    st.markdown(
        f"<p style='color:{TEXT_LIGHT};margin-bottom:1.5rem;'>Search a make & model to see which model would serve it, and what coverage mode would be used.</p>",
        unsafe_allow_html=True,
    )

    col1, col2 = st.columns(2)
    with col1:
        make_input = st.text_input("Make (Brand)", value="bmw", key="cov_make")
    with col2:
        model_input = st.text_input("Model", value="x3", key="cov_model")

    if st.button("Search", type="primary"):
        mk = make_input.strip().lower()
        md = model_input.strip().lower()
        st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)

        if not mk or not md:
            st.warning("Please enter both make and model.")
            st.stop()

        # Try to use internal routing logic directly; fall back gracefully if imports fail
        try:
            import sys
            # Resolve project root relative to this dashboard file (admin/dashboard.py -> ..)
            _project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if _project_root not in sys.path:
                sys.path.insert(0, _project_root)

            from app.services.model.router import resolve_model_for_prediction
            from app.services.model.model_state import check_make_known, get_model_coverage
            from app.core.model_registry import load_registry
            import app.services.model.model_state as _ms

            try:
                _ms.load_valid_cars()
                _ms.load_active_model()
                _ms.load_model_diagnostics()
            except Exception:
                pass

            make_known = check_make_known(mk)
            if not make_known:
                st.markdown(
                    f"<div style='background:rgba(192,57,43,0.05);border:1px solid {ERROR};border-radius:12px;padding:1.5rem;'>"
                    f"<h4 style='margin-top:0;color:{ERROR};'>Unknown Make</h4>"
                    f"<p style='color:{TEXT};margin:0;'>Make '{mk}' is not available. Request would be rejected.</p></div>",
                    unsafe_allow_html=True,
                )
                st.stop()

            routing = resolve_model_for_prediction(mk, md)
            mode_colors = {
                "exact_match": (SUCCESS, "Exact match — active model serves this combo directly."),
                "known_make_model_missing": (PRIMARY, "Known make / unknown model — active model generalizes with degraded confidence."),
                "unknown_make": (ERROR, "Unknown make — request would be rejected."),
            }
            color, desc = mode_colors.get(routing.coverage_mode, (TEXT_LIGHT, "Unknown mode."))
            reason_html = (
                f'<p style="color:{TEXT_LIGHT};margin:0.5rem 0 0 0;font-size:0.85rem;"><b>Reason:</b> {routing.fallback_reason}</p>'
                if routing.fallback_reason else ''
            )
            st.markdown(
                f"<div style='background:{WHITE};border:1px solid {BORDER};border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;'>"
                f"<h3 style='margin-top:0;color:{PRIMARY};'>Routing Result</h3>"
                f"<div style='display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0;'>"
                f"<div style='background:{color}15;border:1px solid {color};border-radius:8px;padding:1rem;flex:1;min-width:200px;'>"
                f"<div style='font-size:0.75rem;color:{TEXT_LIGHT};text-transform:uppercase;letter-spacing:0.5px;'>Coverage Mode</div>"
                f"<div style='font-size:1.3rem;font-weight:700;color:{color};margin-top:0.3rem;'>{routing.coverage_mode}</div></div>"
                f"<div style='background:{PRIMARY}08;border:1px solid {BORDER};border-radius:8px;padding:1rem;flex:1;min-width:200px;'>"
                f"<div style='font-size:0.75rem;color:{TEXT_LIGHT};text-transform:uppercase;letter-spacing:0.5px;'>Fallback Used</div>"
                f"<div style='font-size:1.3rem;font-weight:700;color:{PRIMARY};margin-top:0.3rem;'>{'Yes' if routing.fallback_used else 'No'}</div></div>"
                f"<div style='background:{PRIMARY}08;border:1px solid {BORDER};border-radius:8px;padding:1rem;flex:1;min-width:200px;'>"
                f"<div style='font-size:0.75rem;color:{TEXT_LIGHT};text-transform:uppercase;letter-spacing:0.5px;'>Target Model</div>"
                f"<div style='font-size:1.1rem;font-weight:600;color:{PRIMARY};margin-top:0.3rem;'>{routing.target_model_id or 'Active Model'}</div></div></div>"
                f"<p style='color:{TEXT_LIGHT};margin:0;font-size:0.9rem;'>{desc}</p>"
                f"{reason_html}</div>",
                unsafe_allow_html=True,
            )

            reg = load_registry()
            models = reg.get("models", {})
            matches = []
            for model_id in models:
                cov = get_model_coverage(model_id)
                if cov and (mk, md) in cov:
                    matches.append(model_id)

            if matches:
                st.markdown(f"<h4 style='color:{PRIMARY};'>Models Supporting This Exact Combo</h4>", unsafe_allow_html=True)
                for mid in matches:
                    is_active = mid == _ms.ACTIVE_MODEL_ID
                    st.markdown(
                        f"<span style='display:inline-block;padding:4px 12px;margin:4px;background:{PRIMARY if is_active else '#F0EDE6'};border-radius:6px;color:{WHITE if is_active else TEXT};font-size:0.85rem;font-weight:{600 if is_active else 400};'>{mid} {'(ACTIVE)' if is_active else ''}</span>",
                        unsafe_allow_html=True,
                    )
            else:
                st.markdown(
                    f"<div style='background:rgba(230,126,34,0.05);border:1px solid {WARNING};border-radius:8px;padding:1rem;'>"
                    f"<p style='margin:0;color:{TEXT};font-size:0.9rem;'>"
                    f"No registered model has exact coverage for <b>({mk}, {md})</b>. The active model would generalize if the make is known.</p></div>",
                    unsafe_allow_html=True,
                )
        except Exception as e:
            st.error(
                f"Coverage Explorer requires the ML service Python environment. "
                f"Error: {e}"
            )