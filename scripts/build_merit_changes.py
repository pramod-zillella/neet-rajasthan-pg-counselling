"""Export audited Round 1 -> Round 2 list changes, without inferring withdrawals."""
from pathlib import Path
import csv
import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.utils import get_column_letter
from build_2026_merit import COLUMNS, write_workbook

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT/'data'
AIR = 61347
SITE = 'https://pramod-zillella.github.io/neet-rajasthan-pg-counselling/'
FIELDS = ['registration_id','domicile','service_status','considered_category','neet_marks',
          'bonus_marks','total_marks','in_service_experience_years','additional_category_filled','additional_category_verified']

def source(row):
    return SITE+f"documents/2026/merit/round-{1 if row['round']=='Round 1' else 2}.pdf#page={row['pdf_page']}" if row else ''

def build():
    rows = json.loads((DATA/'2026-merit.json').read_text(encoding='utf-8'))
    rounds = [[r for r in rows if r['round']==f'Round {n}'] for n in [1,2]]
    left, right = [{r['neet_pg_air']:r for r in group} for group in rounds]
    assert len(left)==3165 and len(right)==3413
    assert len({r['registration_id'] for r in left.values()})==len(left)
    assert len({r['registration_id'] for r in right.values()})==len(right)
    reg1={r['registration_id']:air for air,r in left.items()}
    reg2={r['registration_id']:air for air,r in right.items()}
    assert all(reg1[reg]==reg2[reg] for reg in reg1.keys()&reg2.keys()), 'Conflicting registration/AIR identities'
    assert all(left[air]['registration_id']==right[air]['registration_id'] for air in left.keys()&right.keys()), 'Review changed registration identifiers'
    target1,target2=left[AIR],right[AIR]
    assert (target1['state_merit_rank'],target2['state_merit_rank'])==(2091,2193)
    records=[]
    for air in sorted(left.keys()|right.keys()):
        a,b=left.get(air),right.get(air)
        record={'neet_pg_air':air, 'membership':'Added in Round 2' if not a else 'Absent from Round 2' if not b else 'Listed in both',
                'changed_fields':'; '.join(k for k in FIELDS if a and b and a[k]!=b[k])}
        for prefix,r in [('r1',a),('r2',b)]:
            for field in ['registration_id','state_merit_rank','domicile','service_status','considered_category','neet_marks','bonus_marks','total_marks','additional_category_filled','additional_category_verified','pdf_page']:
                record[f'{prefix}_{field}']=r[field] if r else None
            record[f'{prefix}_source_pdf_url']=source(r)
        for basis in ['state','air']:
            before=bool(a and (a['state_merit_rank']<target1['state_merit_rank'] if basis=='state' else air<AIR))
            after=bool(b and (b['state_merit_rank']<target2['state_merit_rank'] if basis=='state' else air<AIR))
            record[f'{basis}_ahead_round1']=before;record[f'{basis}_ahead_round2']=after
            record[f'{basis}_change']=('Moved ahead' if a else 'Added ahead') if after and not before else ('Moved below' if b else 'Absent from Round 2') if before and not after else ('Ahead · details changed' if record['changed_fields'] else 'Still ahead') if before and after else 'Outside comparison'
        records.append(record)
    summary=[]
    groups=['Rajasthan · In-Service','Rajasthan · Non-Service','Other domicile · In-Service','Other domicile · Non-Service','Domicile not applicable']
    def group(r):
        return 'Domicile not applicable' if not r['domicile'] or r['domicile']=='Not Applicable' else ('Rajasthan' if r['domicile']=='Rajasthan' else 'Other domicile')+' · '+r['service_status']
    for basis in ['state','air']:
        aa=[left[r['neet_pg_air']] for r in records if r[f'{basis}_ahead_round1']]
        bb=[right[r['neet_pg_air']] for r in records if r[f'{basis}_ahead_round2']]
        for label in groups+['All candidates']:
            n1=sum(label=='All candidates' or group(r)==label for r in aa)
            n2=sum(label=='All candidates' or group(r)==label for r in bb)
            summary.append({'basis':basis,'group':label,'round1':n1,'round2':n2,'net_change':n2-n1})
    state_records=[r for r in records if r['state_ahead_round1'] or r['state_ahead_round2']]
    air_records=[r for r in records if r['air_ahead_round1'] or r['air_ahead_round2']]
    assert sum(r['membership']=='Added in Round 2' for r in records)==248
    assert sum(r['membership']=='Absent from Round 2' for r in records)==0
    assert sum(r['state_change']=='Added ahead' for r in records)==102
    assert sum(r['air_change']=='Added ahead' for r in records)==88
    assert len(state_records)==2192 and len(air_records)==1854
    notes=[
        ('Scope','2026 revised Round 1 (28 October) vs provisional Round 2 (20 November). Default AIR 61,347; R1 state rank 2,091, R2 state rank 2,193.'),
        ('Matching','Exact NEET-PG AIR within the same exam year; unique within each round and cross-checked against registration ID. Every shared candidate has the same registration ID.'),
        ('State order','Before the target candidate’s round-specific state merit position: 2,090 -> 2,192; 102 additions, zero removals and zero retained candidates crossing the threshold.'),
        ('AIR threshold','Strictly better AIR (<61,347), regardless of bonus: 1,766 -> 1,854; 88 additions and zero removals. Target excluded.'),
        ('In-service bonus','14 new candidates have worse AIR than 61,347 but are ahead in the state list due to bonus marks. Count them in state-order analysis, not better-AIR analysis.'),
        ('Whole lists','All 3,165 Round 1 candidates remain listed. Round 2 adds 248 candidates for 3,413 total. These lists do not establish who joined, withdrew, is eligible for a particular pool or will fill choices.'),
        ('Interpretation','An absence is only absence from the compared list, not proof of withdrawal. A new row is newly listed, not necessarily newly registered. Domicile does not establish seat eligibility.'),
        ('Domicile','Not Applicable remains a separate group and is excluded from All Except Rajasthan. Rajasthan candidates may also compete for private-college AI seats.'),
        ('Privacy','Derived files omit names, relatives, gender and NEET roll numbers. Public Board PDFs are retained unchanged as sources.'),
        ('Rank change','A higher state-rank number indicates a later list position. Do not compare the same numeric state-rank cutoff across rounds to track one candidate.'),
        ('Provenance','Supplied Round 2 PDF verified byte-for-byte against https://pg.neetrajasthan.com/notifications/1795180258933.pdf on 20 November 2026.'),
    ]
    payload={'exam_year':2026,'as_of':'2026-11-20','target_air':AIR,'target_round1':target1,'target_round2':target2,'notes':dict(notes),'summary':summary,'rows':records}
    (DATA/'2026-merit-changes.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    for name,items in [('2026-merit-changes',records),('2026-merit-changes-ahead-61347',state_records),('2026-merit-changes-summary',summary)]:
        with (DATA/f'{name}.csv').open('w',encoding='utf-8-sig',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=list(items[0]));writer.writeheader();writer.writerows(items)
    wb=Workbook();wb.remove(wb.active)
    sheets={'Read first':[{'Topic':k,'Meaning':v} for k,v in notes], 'Summary':summary,
            'New ahead - state':[r for r in records if r['state_change']=='Added ahead'],
            'All ahead - state':state_records,'All better AIR':air_records,
            'All list changes':records,
            'Round 1 merit':[{**r,'source_pdf_url':source(r)} for r in rounds[0]],
            'Round 2 merit':[{**r,'source_pdf_url':source(r)} for r in rounds[1]]}
    for index,(name,items) in enumerate(sheets.items(),1):
        ws=wb.create_sheet(name);headers=list(items[0]);ws.append(headers)
        for row in items:ws.append([row[k] for k in headers])
        ws.freeze_panes='B2';ws.sheet_view.showGridLines=False
        table=Table(displayName=f'MeritChanges{index}',ref=ws.dimensions)
        table.tableStyleInfo=TableStyleInfo(name='TableStyleMedium2',showRowStripes=True);ws.add_table(table)
        for col,label in enumerate(headers,1):
            ws.column_dimensions[get_column_letter(col)].width=100 if label=='Meaning' else 42 if 'url' in label or label=='changed_fields' else 27
            ws.cell(1,col).font=Font(bold=True,color='FFFFFF');ws.cell(1,col).fill=PatternFill('solid',fgColor='184D55');ws.cell(1,col).alignment=Alignment(wrap_text=True)
            if label.endswith('url'):
                for cell in list(ws.columns)[col-1][1:]:
                    if cell.value:cell.hyperlink=cell.value;cell.style='Hyperlink'
        ws.row_dimensions[1].height=32
        if name=='Read first':
            for row in ws.iter_rows(min_row=2):
                for cell in row:cell.alignment=Alignment(wrap_text=True,vertical='top')
                ws.row_dimensions[row[0].row].height=45
    wb.save(DATA/'Rajasthan-NEET-PG-2026-Round-1-vs-Round-2.xlsx')
    # Refresh source links in the round workbooks after the verified public URL was resolved.
    for n,items in enumerate(rounds,1):write_workbook(items,n,DATA)
    print(json.dumps({'r1_target_rank':target1['state_merit_rank'],'r2_target_rank':target2['state_merit_rank'],'whole_list_added':248,'whole_list_removed':0,'state_ahead_added':102,'better_air_added':88,'summary':summary},ensure_ascii=False,indent=2))

if __name__=='__main__':build()
