# """
# End-to-end tests for onConnect behaviour: when a user connects a source box
# (output) to a target box (input), the target should immediately receive the
# source's output without re-running the source.

# Workflows: Data Loading (source) → Data Pool / VIS_VEGA / VIS_D3 / VIS_TABLE (target).
# Each workflow has no edges initially; the test runs the source, then connects
# via drag-and-drop, and asserts the target displays the data.
# """

# import os
# import re
# import time
# import pytest
# from playwright.sync_api import Page

# from .utils import REPO_ROOT, upload_workflow, debug_log
# from .fixtures import workflow_frontend, workflow_page
# from .test_workflows import parse_workflow

# # OnConnect workflows: source-dl (DATA_LOADING) + target-* (various), no edges
# ONCONNECT_WORKFLOW_FILES = [
#     os.path.join(REPO_ROOT, "tests", "OnConnect_DataPool.json"),
#     os.path.join(REPO_ROOT, "tests", "OnConnect_Vega.json"),
#     os.path.join(REPO_ROOT, "tests", "OnConnect_D3.json"),
#     os.path.join(REPO_ROOT, "tests", "OnConnect_Table.json"),
# ]


# def _onconnect_workflow_files():
#     """Return paths for OnConnect workflows that exist."""
#     return [f for f in ONCONNECT_WORKFLOW_FILES if os.path.exists(f)]


# @pytest.fixture(scope="class")
# def onconnect_loaded(request, workflow_frontend, workflow_page):
#     """Upload an OnConnect workflow and expose spec + page to the class."""
#     workflow_file = request.param
#     spec = parse_workflow(workflow_file)
#     debug_log(
#         "test_on_connect.py:onconnect_loaded",
#         "Uploading OnConnect workflow",
#         {
#             "workflow_file": workflow_file,
#             "nodes_count": spec.nodes_count,
#         },
#         "H3,H4",
#     )
#     upload_workflow(
#         workflow_page, workflow_frontend, workflow_file, spec.nodes_count,
#         node_wait_timeout=25000,
#     )
#     request.cls.spec = spec
#     request.cls.page = workflow_page
#     yield


# def _source_node(spec):
#     """Return the DATA_LOADING node (source)."""
#     for n in spec.nodes:
#         if n.type == "DATA_LOADING":
#             return n
#     raise ValueError("No DATA_LOADING node in workflow")


# def _target_node(spec):
#     """Return the target node (DATA_POOL, VIS_VEGA, VIS_D3, or VIS_TABLE)."""
#     for n in spec.nodes:
#         if n.type in ("DATA_POOL", "VIS_VEGA", "VIS_D3", "VIS_TABLE"):
#             return n
#     raise ValueError("No target node (DATA_POOL/VIS_VEGA/VIS_D3/VIS_TABLE) in workflow")


# def _run_source(page: Page, source_id: str):
#     """Click play on the source node and wait for Done."""
#     node_el = page.locator(f'.react-flow__node[data-id="{source_id}"]')
#     node_el.scroll_into_view_if_needed()
#     play_btn = node_el.locator("svg.fa-circle-play")
#     play_btn.wait_for(state="visible", timeout=5000)
#     play_btn.click(force=True)
#     node_el.locator("span").filter(
#         has_text=re.compile(r"^Done$")
#     ).first.wait_for(state="visible", timeout=100000)
#     done_span = node_el.locator("span").filter(has_text=re.compile(r"^Done$"))
#     assert done_span.count() >= 1, f"Source {source_id} did not produce Done"


# def _connect_handles(page: Page, source_id: str, target_id: str):
#     """Drag from source output handle to target input handle.

#     Uses coordinate-based mouse movement to avoid node content (e.g. "No data
#     available", widgets editor) intercepting pointer events during drag_to.
#     """
#     source_handle = page.locator(
#         f'.react-flow__node[data-id="{source_id}"] [data-handleid="out"]'
#     )
#     target_handle = page.locator(
#         f'.react-flow__node[data-id="{target_id}"] [data-handleid="in"]'
#     )
#     source_handle.first.wait_for(state="visible", timeout=5000)
#     target_handle.first.wait_for(state="visible", timeout=5000)

#     src_box = source_handle.first.bounding_box()
#     tgt_box = target_handle.first.bounding_box()
#     assert src_box and tgt_box, "Handle bounding boxes not found"
#     src_center = (src_box["x"] + src_box["width"] / 2, src_box["y"] + src_box["height"] / 2)
#     tgt_center = (tgt_box["x"] + tgt_box["width"] / 2, tgt_box["y"] + tgt_box["height"] / 2)

#     page.mouse.move(src_center[0], src_center[1])
#     page.mouse.down()
#     page.mouse.move(tgt_center[0], tgt_center[1])
#     page.mouse.up()

#     # Wait for edge to appear
#     page.wait_for_function(
#         "document.querySelectorAll('.react-flow__edge').length >= 1",
#         timeout=5000,
#     )


# def _assert_target_received_data(page: Page, target_id: str, target_type: str):
#     """Assert the target box displays the propagated data."""
#     node_el = page.locator(f'.react-flow__node[data-id="{target_id}"]')
#     node_el.scroll_into_view_if_needed()

#     if target_type == "DATA_POOL":
#         data_table = node_el.locator("td.MuiTableCell-root")
#         data_table.first.wait_for(state="visible", timeout=10000)
#         assert data_table.count() >= 1, (
#             f"DataPool {target_id} did not show data table after connect"
#         )
#     elif target_type == "VIS_TABLE":
#         # VIS_TABLE renders ContentTable with table cells
#         table_cells = node_el.locator("td")
#         table_cells.first.wait_for(state="visible", timeout=10000)
#         assert table_cells.count() >= 1, (
#             f"VIS_TABLE {target_id} did not show table after connect"
#         )
#     elif target_type in ("VIS_VEGA", "VIS_D3"):
#         # Grammar boxes: click play to render, then check for chart or Done
#         play_btn = node_el.locator("svg.fa-circle-play")
#         play_btn.wait_for(state="visible", timeout=5000)
#         play_btn.click(force=True)
#         node_el.locator("span").filter(
#             has_text=re.compile(r"^Done$")
#         ).first.wait_for(state="visible", timeout=60000)
#         # Chart should be visible (canvas or svg)
#         chart = node_el.locator("canvas, svg.vega-embed, svg[width]")
#         chart.first.wait_for(state="visible", timeout=10000)
#         assert chart.count() >= 1, (
#             f"{target_type} {target_id} did not render chart after connect + play"
#         )
#     else:
#         raise ValueError(f"Unknown target type: {target_type}")


# @pytest.mark.parametrize(
#     "onconnect_loaded",
#     _onconnect_workflow_files(),
#     indirect=True,
#     ids=[os.path.basename(f) for f in _onconnect_workflow_files()],
# )
# class TestOnConnect:
#     """E2E tests: connect source to target and verify target receives data."""

#     def test_on_connect_propagates_data(self, onconnect_loaded):
#         """
#         1. Run the source (DATA_LOADING).
#         2. Connect source output to target input via drag-and-drop.
#         3. Assert the target immediately displays the propagated data.
#         """
#         source = _source_node(self.spec)
#         target = _target_node(self.spec)

#         _run_source(self.page, source.id)
#         time.sleep(0.5)  # Allow output to settle

#         _connect_handles(self.page, source.id, target.id)
#         time.sleep(0.5)  # Allow propagation

#         _assert_target_received_data(self.page, target.id, target.type)
