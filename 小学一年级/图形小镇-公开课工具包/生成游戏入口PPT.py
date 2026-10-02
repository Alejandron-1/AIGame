# -*- coding: utf-8 -*-
"""手工打包 OOXML：游戏入口.pptx（5 页按钮页，整页图片+超链接到课件对应环节）"""
import zipfile, os
from urllib.parse import quote

BASE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(BASE, '游戏入口.pptx')
IMGDIR = os.path.join(BASE, '按钮页')
TARGET_HTML = '../认识立体图形-图形小镇课件.html'

SLIDES = [
    ('按钮-cover.png', TARGET_HTML),           # 完整课件（#cover 可省）
    ('按钮-game1.png', TARGET_HTML + '#game1'),
    ('按钮-game2.png', TARGET_HTML + '#game2'),
    ('按钮-game3.png', TARGET_HTML + '#game3'),
    ('按钮-game4.png', TARGET_HTML + '#game4'),
]
NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
RT_SLIDE = NS_R + '/slide'
RT_IMG   = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
RT_HLINK = NS_R + '/hyperlink'
RT_MASTER= NS_R + '/slideMaster'
RT_THEME = NS_R + '/theme'
RT_LAYOUT= NS_R + '/slideLayout'

def rels(pairs):
    x = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">']
    for rid, t, tgt, mode in pairs:
        m = ' TargetMode="External"' if mode else ''
        x.append(f'<Relationship Id="{rid}" Type="{t}" Target="{tgt}"{m}/>')
    x.append('</Relationships>')
    return ''.join(x)

def slide_xml(img_rid, link_rid):
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{NS_R}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="button"><a:hlinkClick r:id="{link_rid}" action=""/></p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="{img_rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'''

THEME = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="blank"><a:themeElements><a:clrScheme name="blank"><a:dk1><a:srgbClr val="3F3A34"/></a:dk1><a:lt1><a:srgbClr val="FAF6EE"/></a:lt1><a:dk2><a:srgbClr val="3F3A34"/></a:dk2><a:lt2><a:srgbClr val="FAF6EE"/></a:lt2><a:accent1><a:srgbClr val="F5A35C"/></a:accent1><a:accent2><a:srgbClr val="7FB2E5"/></a:accent2><a:accent3><a:srgbClr val="7FC8A8"/></a:accent3><a:accent4><a:srgbClr val="F2A6B8"/></a:accent4><a:accent5><a:srgbClr val="FFCE4F"/></a:accent5><a:accent6><a:srgbClr val="8ED081"/></a:accent6><a:hlink><a:srgbClr val="5F92C9"/></a:hlink><a:folHlink><a:srgbClr val="8B8378"/></a:folHlink></a:clrScheme><a:fontScheme name="blank"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface="微软雅黑"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface="微软雅黑"/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="blank"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'''

spTree_head = '''<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'''
MASTER = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{NS_R}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>{spTree_head}</p:spTree></p:cSld><p:clrMap><p:masterClrMapping/></p:clrMap><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>'''
LAYOUT = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{NS_R}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="blank"><p:spTree>{spTree_head}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'''

sld_ids, pres_rels, overrides = [], [], []
for i, (img, target) in enumerate(SLIDES, 1):
    sld_ids.append(f'<p:sldId id="{255+i}" r:id="rId{1+i}"/>')
    pres_rels.append((f'rId{1+i}', RT_SLIDE, f'slides/slide{i}.xml', False))
    overrides.append(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>')

PRESENTATION = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{NS_R}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>{''.join(sld_ids)}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'''
PRES_RELS = rels([('rId1', RT_MASTER, 'slideMasters/slideMaster1.xml', False)] + pres_rels)
CONTENT_TYPES = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>{''.join(overrides)}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'''
ROOT_RELS = rels([
    ('rId1', NS_R + '/officeDocument', 'ppt/presentation.xml', False),
    ('rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml', False),
    ('rId3', NS_R + '/extended-properties', 'docProps/app.xml', False),
])
CORE = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>立体图形小镇 · 公开课游戏入口</dc:title><dc:creator>AIGame</dc:creator></cp:coreProperties>'''
APP = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Office PowerPoint</Application></Properties>'''

z = zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED)
z.writestr('[Content_Types].xml', CONTENT_TYPES)
z.writestr('_rels/.rels', ROOT_RELS)
z.writestr('docProps/core.xml', CORE)
z.writestr('docProps/app.xml', APP)
z.writestr('ppt/presentation.xml', PRESENTATION)
z.writestr('ppt/_rels/presentation.xml.rels', PRES_RELS)
z.writestr('ppt/slideMasters/slideMaster1.xml', MASTER)
z.writestr('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([
    ('rId1', RT_LAYOUT, '../slideLayouts/slideLayout1.xml', False),
    ('rId2', RT_THEME, '../theme/theme1.xml', False)]))
z.writestr('ppt/slideLayouts/slideLayout1.xml', LAYOUT)
z.writestr('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([
    ('rId1', RT_MASTER, '../slideMasters/slideMaster1.xml', False)]))
z.writestr('ppt/theme/theme1.xml', THEME)
for i, (img, target) in enumerate(SLIDES, 1):
    z.writestr(f'ppt/slides/slide{i}.xml', slide_xml('rId1', 'rId2'))
    enc = quote(target, safe='/#')   # 保留 # 与路径分隔符（#是页内锚点，不能编码成%23）
    z.writestr(f'ppt/slides/_rels/slide{i}.xml.rels', rels([
        ('rId1', RT_IMG, f'../media/{img}', False),
        ('rId2', RT_HLINK, enc, True)]))
    z.write(os.path.join(IMGDIR, img), f'ppt/media/{img}')
z.close()
print('生成:', os.path.abspath(OUT), os.path.getsize(OUT)//1024, 'KB')
