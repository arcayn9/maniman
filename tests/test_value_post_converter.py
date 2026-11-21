"""Synthetic-only tests for the screenshot's seven-column statement layout."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

from tools.statement_converter.converter import ConversionError, convert_file, convert_pages

HEADER = "Value Date | Post Date | Details | Ref No/Cheque No | ₹ Debit | ₹ Credit | Balance"
META = "State Bank of India\nAccount: XXXX4321\nAccount Type: savings\nStatement From : 01-02-2026 to 28-02-2026\n"
DEBIT = "02/02/2026 | 03/02/2026 | UPI SYNTHETIC GROCER | SYNTHETIC-A | 123.45 | | 9,876.55"
CREDIT = "04/02/2026 | 04/02/2026 | SYNTHETIC CREDIT | SYNTHETIC-B | | 500.00 | 10,376.55"


def convert(text):
    return convert_pages([text], hashlib.sha256(text.encode()).hexdigest())


def grid_pdf(pages):
    """Small ASCII-font PDFs with actual grid lines and fully invented rows.

    Each page is (show_header, rows, optional column offset). No user files or
    screenshots are opened to build these regression fixtures.
    """
    objects = [b"", b"", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    page_ids = []
    def literal(text):
        return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
    for show_header, rows, offset in pages:
        commands = []
        def text(x, y, value):
            commands.append(f"BT /F1 8 Tf {x} {y} Td ({literal(value)}) Tj ET")
        text(30, 760, 'State Bank of India')
        text(30, 745, 'Account: XXXX4321')
        text(30, 730, 'Account Type: savings')
        text(30, 715, 'Statement From : 01-02-2026 to 28-02-2026')
        xs = [30 + offset, 105 + offset, 180 + offset, 340 + offset, 435 + offset, 510 + offset, 585 + offset, 690 + offset]
        header = ['Value Date', 'Post Date', 'Details', 'Ref No/\nCheque\nNo', 'INR Debit', 'INR Credit', 'Balance']
        all_rows = ([header] if show_header else []) + rows
        ys = [680]
        for index, row in enumerate(all_rows):
            height = 60 if show_header and index == 0 else 50
            for x, cell in zip(xs, row):
                for line_index, line in enumerate(cell.split('\n')):
                    text(x + 4, ys[-1] - 14 - line_index * 12, line)
            ys.append(ys[-1] - height)
        for x in xs:
            commands.append(f"{x} {ys[-1]} m {x} {ys[0]} l S")
        for y in ys:
            commands.append(f"{xs[0]} {y} m {xs[-1]} {y} l S")
        stream = '\n'.join(commands).encode('ascii')
        page_id = len(objects) + 1
        stream_id = page_id + 1
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 760 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_id} 0 R >>".encode())
        objects.append(f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream")
        page_ids.append(page_id)
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[1] = f"<< /Type /Pages /Kids [{' '.join(str(i)+' 0 R' for i in page_ids)}] /Count {len(page_ids)} >>".encode()
    output = bytearray(b'%PDF-1.4\n')
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f'{index} 0 obj\n'.encode() + obj + b'\nendobj\n')
    start = len(output)
    output.extend(f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode())
    for position in offsets[1:]:
        output.extend(f'{position:010d} 00000 n \n'.encode())
    output.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode())
    return bytes(output)


class ValuePostTextTests(unittest.TestCase):
    def test_explicit_currency_columns_and_both_dates_are_retained(self):
        result = convert(META + HEADER + '\n' + DEBIT + '\n' + CREDIT)
        section = result['statements'][0]
        self.assertEqual(result['source']['profile'], 'value-post-grid-v1')
        self.assertEqual(result['institution']['name'], 'State Bank of India')
        self.assertEqual(section['extraction']['status'], 'complete')
        self.assertEqual(section['account']['currency'], 'INR')
        tx = section['transactions'][0]
        self.assertEqual(tx['transactionDate'], '2026-02-03')
        self.assertEqual(tx['postingDate'], '2026-02-03')
        self.assertEqual(tx['valueDate'], '2026-02-02')
        self.assertEqual(tx['amountMinor'], 12345)
        self.assertEqual(tx['direction'], 'debit')
        self.assertEqual(section['transactions'][1]['direction'], 'credit')
        self.assertEqual(section['observedTransactionRange']['start'], '2026-02-03')

    def test_layout_does_not_invent_bank_identity_or_currency(self):
        result = convert(HEADER.replace('₹ ', '') + '\n' + DEBIT)
        self.assertEqual(result['institution']['status'], 'unknown')
        self.assertIsNone(result['statements'][0]['account']['currency'])
        self.assertEqual(result['statements'][0]['extraction']['status'], 'failed')

    def test_labeled_currency_cannot_be_overridden_with_a_different_one(self):
        with self.assertRaises(ConversionError):
            convert_pages([META + HEADER + '\n' + DEBIT], 'a' * 64, currency_override='USD')

    def test_invalid_date_and_ambiguous_amounts_are_excluded(self):
        for row in [DEBIT.replace('03/02/2026', '31/02/2026'), DEBIT.replace('123.45 | |', '123.45 | 20.00 |')]:
            result = convert(META + HEADER + '\n' + row)
            extraction = result['statements'][0]['extraction']
            self.assertEqual(extraction['status'], 'failed')
            self.assertEqual(extraction['transactionRowCount'], 1)
            self.assertEqual(len(extraction['excludedRows']), 1)


@unittest.skipUnless(importlib.util.find_spec('pdfplumber'), 'optional local PDF dependency not installed')
class ValuePostPdfTests(unittest.TestCase):
    debit = ['02/02/2026', '03/02/2026', 'UPI SYNTHETIC\nGROCER', 'SYNTHETIC-A', '123.45', '', '9,876.55']
    credit = ['04/02/2026', '04/02/2026', 'SYNTHETIC CREDIT', 'SYNTHETIC-B', '', '500.00', '10,376.55']

    def extract(self, pages):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'synthetic-grid.pdf'
            source.write_bytes(grid_pdf(pages))
            return convert_file(source)

    def test_real_pdf_preserves_wrapped_header_narration_and_empty_direction_cells(self):
        result = self.extract([(True, [self.debit, self.credit], 0)])
        section = result['statements'][0]
        self.assertEqual(section['extraction']['status'], 'complete')
        self.assertEqual(len(section['transactions']), 2)
        self.assertEqual(section['transactions'][0]['description'], 'UPI SYNTHETIC GROCER')
        self.assertEqual(section['transactions'][0]['references'][0]['value'], 'SYNTHETIC-A')
        self.assertEqual([tx['amountMinor'] for tx in section['transactions']], [12345, 50000])
        self.assertEqual([tx['direction'] for tx in section['transactions']], ['debit', 'credit'])

    def test_literal_cell_delimiters_are_excluded_instead_of_changing_direction(self):
        damaged = list(self.debit)
        damaged[2] = 'SYNTHETIC | EXTRA COLUMN'
        result = self.extract([(True, [damaged, self.credit], 0)])
        section = result['statements'][0]
        self.assertEqual(section['extraction']['status'], 'partial')
        self.assertEqual(len(section['transactions']), 1)
        self.assertEqual(section['transactions'][0]['direction'], 'credit')
        self.assertEqual(len(section['extraction']['excludedRows']), 1)

    def test_repeated_headers_and_matching_headerless_continuations(self):
        for repeated in [True, False]:
            with self.subTest(repeated=repeated):
                result = self.extract([(True, [self.debit], 0), (repeated, [self.credit], 0)])
                section = result['statements'][0]
                self.assertEqual(section['extraction']['status'], 'complete')
                self.assertEqual([tx['sourceLocation']['page'] for tx in section['transactions']], [1, 2])

    def test_orphan_continuation_or_changed_columns_never_produce_complete_output(self):
        orphan = ['', '', 'UNATTACHED SYNTHETIC NARRATION', '', '', '', '']
        for second in [(False, [orphan, self.credit], 0), (False, [self.credit], 9), (False, [[value or '-' for value in self.credit]], 9)]:
            with self.subTest(shape=bool(second[2])):
                result = self.extract([(True, [self.debit], 0), second])
                section = result['statements'][0]
                self.assertEqual(section['extraction']['status'], 'partial')
                self.assertGreater(len(section['extraction']['excludedRows']), 0)


if __name__ == '__main__':
    unittest.main()
