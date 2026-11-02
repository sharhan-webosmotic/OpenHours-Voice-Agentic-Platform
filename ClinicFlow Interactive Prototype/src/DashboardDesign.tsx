const assetPathPrefix = '/assets';
const imgFriendlyFuturisticRobotAssistant1 = `${assetPathPrefix}/53aab.png`;
const imgIcon = `${assetPathPrefix}/068f7.svg`;
const imgIcon1 = `${assetPathPrefix}/d58e7.svg`;
const imgIcon2 = `${assetPathPrefix}/27833.svg`;
const imgIcon3 = `${assetPathPrefix}/be24d.svg`;
const imgIcon4 = `${assetPathPrefix}/8bbd1.svg`;
const imgIcon5 = `${assetPathPrefix}/0cc00.svg`;
const imgIcon6 = `${assetPathPrefix}/820e1.svg`;
const imgIcon7 = `${assetPathPrefix}/a4d71.svg`;
const imgIcon8 = `${assetPathPrefix}/9a97a.svg`;
const imgIcon9 = `${assetPathPrefix}/8c2ed.svg`;
const imgIcon10 = `${assetPathPrefix}/5aa53.svg`;
const imgHeadset = `${assetPathPrefix}/ea970.svg`;
const imgIcon11 = `${assetPathPrefix}/8ca49.svg`;
const imgSearch = `${assetPathPrefix}/e1136.svg`;
const imgIcon12 = `${assetPathPrefix}/348f4.svg`;
const imgIcon13 = `${assetPathPrefix}/fcac4.svg`;
const imgIcon14 = `${assetPathPrefix}/ad0d8.svg`;
const imgIcon15 = `${assetPathPrefix}/72e6e.svg`;
const imgIcon16 = `${assetPathPrefix}/119d7.svg`;
const imgIcon17 = `${assetPathPrefix}/a2967.svg`;
const imgIcon18 = `${assetPathPrefix}/2a6c7.svg`;
const imgIcon19 = `${assetPathPrefix}/96e68.svg`;
const imgIcon20 = `${assetPathPrefix}/7485c.svg`;
const imgIcon21 = `${assetPathPrefix}/8dd6b.svg`;
const imgIcon22 = `${assetPathPrefix}/e0482.svg`;
const imgIcon23 = `${assetPathPrefix}/0fc7b.svg`;
const imgBookedSegment = `${assetPathPrefix}/862bf.svg`;
const imgEnquiriesSegment = `${assetPathPrefix}/67e2c.svg`;
const imgRescheduleRequestsSegment = `${assetPathPrefix}/460b8.svg`;
const imgCancellationRequestsSegment = `${assetPathPrefix}/68eab.svg`;
const imgOtherSegment = `${assetPathPrefix}/01073.svg`;
const imgIcon24 = `${assetPathPrefix}/8ce31.svg`;
const imgCompletedSegment = `${assetPathPrefix}/26ad7.svg`;
const imgPendingSegment = `${assetPathPrefix}/3ba26.svg`;
const imgOverdueSegment = `${assetPathPrefix}/a50ed.svg`;
const imgFailedSegment = `${assetPathPrefix}/cb18a.svg`;
const imgIcon25 = `${assetPathPrefix}/d045b.svg`;
const imgIcon26 = `${assetPathPrefix}/1f7d0.svg`;
const imgIcon27 = `${assetPathPrefix}/c734b.svg`;

const periodMetrics = {
  Today: { calls: 41, bookings: 12, requests: 3, attention: 2, revenue: '$1,740' },
  'Last 7 days': { calls: 286, bookings: 84, requests: 19, attention: 7, revenue: '$12,480' },
  'Last 30 days': { calls: 1108, bookings: 314, requests: 71, attention: 24, revenue: '$45,120' },
  'This month': { calls: 842, bookings: 236, requests: 52, attention: 18, revenue: '$33,840' },
  'Last month': { calls: 918, bookings: 260, requests: 61, attention: 22, revenue: '$37,420' },
  'Custom date range': { calls: 286, bookings: 84, requests: 19, attention: 7, revenue: '$12,480' },
};

export default function ClinicFlowDesktopDashboard({
  period = 'Last 7 days',
}: {
  period?: string;
}) {
  const metrics =
    periodMetrics[period as keyof typeof periodMetrics] || periodMetrics['Last 7 days'];
  const periodDescription = period.toLowerCase();
  return (
    <div
      className="bg-[#f3f5fd] content-stretch flex flex-col items-start relative size-full"
      data-node-id="1:2"
      data-name="ClinicFlow Desktop Dashboard - /"
    >
      <div
        className="bg-[#f3f5fd] grid grid-cols-[220px_minmax(0,1fr)] grid-rows-[_1080px] h-[1323px] min-h-[1080px] min-w-[1920px] overflow-clip relative shrink-0 w-full"
        data-node-id="1:3"
        data-name="Body"
      >
        <div
          className="bg-white border-[#e9edf5] border-r border-solid col-1 content-stretch flex flex-col h-[1080px] items-start justify-self-stretch pb-[20px] pt-[26px] px-[16px] relative row-1 self-start shrink-0"
          data-node-id="1:4"
          data-name="Sidebar"
        >
          <div
            className="content-stretch flex gap-[11px] h-[71px] items-center pb-[25px] px-[10px] relative shrink-0 w-[187px]"
            data-node-id="1:5"
            data-name="Container"
          >
            <div
              className="bg-[#356ae6] drop-shadow-[0px_8px_9px_rgba(53,106,230,0.25)] grid grid-cols-[_34px] grid-rows-[_34px] relative rounded-[11px] shrink-0 size-[34px]"
              data-node-id="1:6"
              data-name="Text"
            >
              <div
                className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[20px]"
                data-node-id="1:7"
                data-name="Icon"
              >
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcon} />
              </div>
            </div>
            <div
              className="content-stretch flex flex-col items-start relative shrink-0"
              data-node-id="1:10"
              data-name="Text"
            >
              <p
                className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[19px] tracking-[-0.5px] whitespace-nowrap"
                data-node-id="1:11"
              >
                ClinicFlow
              </p>
            </div>
          </div>
          <div
            className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full"
            data-node-id="1:14"
            data-name="Navigation - Primary navigation"
          >
            <div
              className="bg-[#eaf1ff] content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:15"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:16"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon1}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:22"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[15px] whitespace-nowrap"
                  data-node-id="1:23"
                >
                  Overview
                </p>
              </div>
            </div>
            <div
              className="content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:24"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:25"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon2}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:29"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[15px] whitespace-nowrap"
                  data-node-id="1:30"
                >
                  Appointments
                </p>
              </div>
            </div>
            <div
              className="content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:31"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:32"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon3}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:35"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[15px] whitespace-nowrap"
                  data-node-id="1:36"
                >
                  Patients
                </p>
              </div>
            </div>
            <div
              className="content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:37"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:38"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon4}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:42"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[15px] whitespace-nowrap"
                  data-node-id="1:43"
                >{`Doctors & Staff`}</p>
              </div>
            </div>
            <div
              className="content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:44"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:45"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon5}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:49"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[15px] whitespace-nowrap"
                  data-node-id="1:50"
                >
                  Services
                </p>
              </div>
            </div>
            <div
              className="content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:51"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:52"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon6}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:55"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[15px] whitespace-nowrap"
                  data-node-id="1:56"
                >
                  Call History
                </p>
              </div>
            </div>
            <div
              className="content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:57"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:58"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon7}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:61"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[15px] whitespace-nowrap"
                  data-node-id="1:62"
                >
                  Follow-ups
                </p>
              </div>
            </div>
            <div
              className="content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:63"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:64"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon8}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:67"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[15px] whitespace-nowrap"
                  data-node-id="1:68"
                >
                  Reminders
                </p>
              </div>
            </div>
            <div
              className="content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:69"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:70"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon9}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:73"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[15px] whitespace-nowrap"
                  data-node-id="1:74"
                >
                  Reports
                </p>
              </div>
            </div>
            <div
              className="content-stretch flex gap-[12px] h-[46px] items-center px-[13px] relative rounded-[12px] shrink-0 w-[187px]"
              data-node-id="1:75"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:76"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon10}
                />
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0"
                data-node-id="1:80"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[15px] whitespace-nowrap"
                  data-node-id="1:81"
                >
                  Clinic Settings
                </p>
              </div>
            </div>
          </div>
          <div
            className="content-stretch flex flex-[1_0_0] flex-col items-start justify-end min-h-px relative w-full"
            data-node-id="1:82"
            data-name="Container:align"
          >
            <div
              className="bg-[#eef3ff] content-stretch flex flex-col gap-[8px] items-center overflow-clip p-[14px] relative rounded-[16px] shrink-0 w-full"
              data-node-id="1:83"
              data-name="Support"
            >
              <div
                className="relative shrink-0 size-[20px]"
                data-node-id="1:84"
                data-name="headset"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgHeadset}
                />
              </div>
              <p
                className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[20px] not-italic relative shrink-0 text-[#17264b] text-[13px] whitespace-nowrap"
                data-node-id="1:86"
              >
                Need help?
              </p>
              <div
                className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[0] min-w-full not-italic relative shrink-0 text-[#64728f] text-[12px] text-center w-[min-content] whitespace-pre-wrap"
                data-node-id="1:87"
              >
                <p className="leading-[14px] mb-0">{`Get support or contact `}</p>
                <p className="leading-[14px]">our team</p>
              </div>
              <div
                className="bg-white border border-[#e6eaf4] border-solid content-stretch flex h-[30px] items-center justify-center overflow-clip px-[10px] relative rounded-[12px] shrink-0 w-full"
                data-node-id="1:88"
                data-name="Button / Secondary"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[14px] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                  data-node-id="1:89"
                >
                  Contact Support
                </p>
              </div>
            </div>
          </div>
        </div>
        <div
          className="col-2 content-stretch flex flex-col h-fit items-start justify-self-stretch overflow-clip relative row-1 self-start shrink-0 w-full"
          data-node-id="1:90"
          data-name="Main Content"
        >
          <div
            className="bg-[rgba(255,255,255,0.94)] border-[#e9edf5] border-b border-solid content-stretch flex gap-[16px] h-[72px] items-center px-[22px] relative shrink-0 w-full"
            data-node-id="1:91"
            data-name="Header"
          >
            <div
              className="h-[42px] relative shrink-0 w-[440px]"
              data-node-id="1:92"
              data-name="Label"
            >
              <div
                className="absolute left-[14px] overflow-clip size-[18px] top-[12px]"
                data-node-id="1:93"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon11}
                />
              </div>
              <div
                className="absolute bg-[#f8faff] border border-[#e9edf5] border-solid content-stretch flex flex-col h-[42px] items-start justify-center left-0 overflow-clip pl-[42px] pr-[40px] rounded-[12px] top-0 w-[440px]"
                data-node-id="1:97"
                data-name="Search Input"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#8d98ae] text-[15px] w-full"
                  data-node-id="1:98"
                >
                  Search patients, appointments or calls…
                </p>
              </div>
              <div
                className="absolute border border-[#e9edf5] border-solid grid-cols-[_25px] grid-rows-[_22px] h-[24px] inline-grid left-[403px] min-w-[27px] rounded-[7px] top-[9px]"
                data-node-id="1:99"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] col-1 font-['Inter:Regular'] font-normal justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#8d98ae] text-[12px] whitespace-nowrap"
                  data-node-id="1:100"
                >
                  ⌘K
                </p>
              </div>
              <div
                className="-translate-y-1/2 absolute left-[10px] size-[16px] top-[calc(50%-0.5px)]"
                data-node-id="1:101"
                data-name="search"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgSearch}
                />
              </div>
            </div>
            <div
              className="flex-[546.75_0_0] h-0 min-w-px relative"
              data-node-id="1:103"
              data-name="Container"
            />
            <div
              className="content-stretch flex flex-col items-start relative shrink-0 w-[138.75px]"
              data-node-id="1:104"
              data-name="Container"
            >
              <div
                className="h-[18px] relative shrink-0 w-full"
                data-node-id="1:105"
                data-name="Container"
              >
                <p
                  className="[word-break:break-word] absolute font-['Inter:Regular'] font-normal leading-[normal] left-0 not-italic text-[#64728f] text-[12px] top-0 whitespace-nowrap"
                  data-node-id="1:106"
                >
                  Today
                </p>
              </div>
              <div
                className="content-stretch flex flex-col h-[21px] items-start pt-[2px] relative shrink-0 w-[138.75px]"
                data-node-id="1:107"
                data-name="Bold Text"
              >
                <p
                  className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[13px] whitespace-nowrap"
                  data-node-id="1:108"
                >
                  Monday, 19 May 2025
                </p>
              </div>
            </div>
            <div
              className="bg-[#356ae6] content-stretch drop-shadow-[0px_7px_9px_rgba(53,106,230,0.2)] flex gap-[8px] h-[40px] items-center justify-center px-[15px] relative rounded-[11px] shrink-0"
              data-node-id="1:109"
              data-name="Button"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:110"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon12}
                />
              </div>
              <p
                className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[14px] text-center text-white whitespace-nowrap"
                data-node-id="1:113"
              >
                New Appointment
              </p>
            </div>
            <div
              className="bg-white border border-[#e9edf5] border-solid content-stretch flex gap-[8px] items-center justify-center relative rounded-[11px] shrink-0 size-[40px]"
              data-node-id="1:114"
              data-name="Button - Notifications"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:115"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon8}
                />
              </div>
              <div
                className="absolute bg-[#ef5350] border-2 border-solid border-white left-[22.77px] rounded-[8px] size-[8px] top-[7.5px]"
                data-node-id="1:118"
                data-name="Text"
              />
            </div>
            <div
              className="bg-white border border-[#e9edf5] border-solid content-stretch flex items-center justify-center relative rounded-[11px] shrink-0 size-[40px]"
              data-node-id="1:119"
              data-name="Button - Help"
            >
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:120"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon13}
                />
              </div>
            </div>
            <div
              className="bg-white border-[#e9edf5] border-l border-solid content-stretch flex gap-[10px] h-[48px] items-center justify-center pl-[4px] pr-[8px] relative shrink-0"
              data-node-id="1:124"
              data-name="Button"
            >
              <div
                className="bg-[#dce6ff] grid grid-cols-[_37px] grid-rows-[_37px] relative rounded-[12px] shrink-0 size-[37px]"
                data-node-id="1:125"
                data-name="Text"
              >
                <p
                  className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#356ae6] text-[14px] text-center whitespace-nowrap"
                  data-node-id="1:126"
                >
                  PS
                </p>
              </div>
              <div
                className="content-stretch flex flex-col items-start relative shrink-0 w-[88.766px]"
                data-node-id="1:127"
                data-name="Text"
              >
                <div
                  className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                  data-node-id="1:128"
                  data-name="Bold Text"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Black'] font-black leading-[15.6px] not-italic relative shrink-0 text-[#17264b] text-[13px] whitespace-nowrap"
                    data-node-id="1:129"
                  >
                    Dr. Priya Shah
                  </p>
                </div>
                <div
                  className="h-[16.797px] relative shrink-0 w-full"
                  data-node-id="1:130"
                  data-name="Container"
                >
                  <p
                    className="[word-break:break-word] absolute font-['Inter:Semi_Bold'] font-semibold leading-[13.2px] left-0 not-italic text-[#64728f] text-[12px] top-[3px] whitespace-nowrap"
                    data-node-id="1:131"
                  >
                    Clinic Owner
                  </p>
                </div>
              </div>
              <div
                className="overflow-clip relative shrink-0 size-[18px]"
                data-node-id="1:132"
                data-name="Icon"
              >
                <img
                  alt=""
                  className="absolute block inset-0 max-w-none size-full"
                  src={imgIcon14}
                />
              </div>
            </div>
          </div>
          <div
            className="gap-x-[16px] gap-y-[16px] grid grid-cols-[minmax(0,1fr)_492px] grid-rows-[_968px] h-[1080px] overflow-clip px-[22px] py-[20px] relative shrink-0 w-full"
            data-node-id="1:135"
            data-name="Container"
          >
            <div
              className="col-1 content-stretch flex flex-col h-fit items-start justify-self-stretch overflow-clip pr-[4px] relative row-1 self-start shrink-0"
              data-node-id="1:136"
              data-name="Section - Practice overview"
            >
              <div
                className="content-start flex flex-wrap gap-[16px] items-start relative shrink-0 w-full"
                data-node-id="1:137"
                data-name="Container"
              >
                <div
                  className="border border-[rgba(233,237,245,0.9)] border-solid content-stretch flex flex-[1_0_0] flex-col h-[170px] items-start min-w-px overflow-clip px-[25px] py-[23px] relative rounded-[18px] shadow-[0px_8px_30px_0px_rgba(37,55,103,0.06)]"
                  data-node-id="1:138"
                  style={{
                    backgroundImage:
                      'linear-gradient(155.00520099051636deg, rgb(255, 255, 255) 16.789%, rgb(231, 222, 255) 91.514%)',
                  }}
                  data-name="Article"
                >
                  <div
                    className="content-stretch flex flex-col items-start max-w-[525px] relative shrink-0 w-[525px]"
                    data-node-id="1:139"
                    data-name="Paragraph"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[20.15px] not-italic relative shrink-0 text-[#17264b] text-[14px] tracking-[0.8px] uppercase whitespace-nowrap"
                      data-node-id="1:140"
                    >
                      Monday overview
                    </p>
                  </div>
                  <div
                    className="content-stretch flex flex-col items-start max-w-[530px] pb-[8px] relative shrink-0 w-[530px]"
                    data-node-id="1:141"
                    data-name="Heading 1"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[30px] not-italic relative shrink-0 text-[#17264b] text-[25px] tracking-[-0.7px] whitespace-nowrap"
                      data-node-id="1:142"
                    >
                      Good morning, Dr. Priya Shah
                    </p>
                  </div>
                  <div
                    className="content-stretch flex flex-col items-start relative shrink-0"
                    data-node-id="1:143"
                    data-name="Paragraph:margin"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[20.15px] not-italic relative shrink-0 text-[#64728f] text-[14px] w-[525px]"
                      data-node-id="1:144"
                    >
                      Your AI receptionist is managing calls and bookings.
                    </p>
                  </div>
                  <div
                    className="content-stretch flex gap-[8px] items-center pt-[20px] relative shrink-0"
                    data-node-id="1:145"
                    data-name="Paragraph:margin"
                  >
                    <div
                      className="bg-[#e7f8f2] content-stretch flex gap-[6px] h-[25px] items-center px-[9px] relative rounded-[999px] shrink-0"
                      data-node-id="1:146"
                      data-name="Text"
                    >
                      <div
                        className="bg-[#20b486] relative rounded-[3px] shadow-[0px_0px_0px_3px_rgba(32,180,134,0.13)] shrink-0 size-[6px]"
                        data-node-id="1:147"
                        data-name="Italic Text"
                      />
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#128461] text-[12px] whitespace-nowrap"
                        data-node-id="1:148"
                      >
                        Online
                      </p>
                    </div>
                    <div
                      className="bg-[#e7f8f2] content-stretch flex h-[25px] items-center px-[9px] relative rounded-[999px] shrink-0"
                      data-node-id="1:149"
                      data-name="Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#128461] text-[12px] whitespace-nowrap"
                        data-node-id="1:150"
                      >
                        Call Forwarding active
                      </p>
                    </div>
                    <p
                      className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[13px] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                      data-node-id="1:151"
                    >
                      Last active 2 min ago
                    </p>
                  </div>
                  <div
                    className="-translate-y-1/2 absolute h-[133px] right-[19px] top-[calc(50%+30.5px)] w-[145px]"
                    data-node-id="1:181"
                    data-name="Friendly Futuristic Robot Assistant 1"
                  >
                    <img
                      alt=""
                      className="absolute inset-0 max-w-none object-cover pointer-events-none size-full"
                      src={imgFriendlyFuturisticRobotAssistant1}
                    />
                  </div>
                  <div
                    className="absolute bg-white border border-[#e9edf5] border-solid h-[33px] right-[12px] rounded-[9px] top-[12px] w-[127px]"
                    data-node-id="1:182"
                    data-name="Dropdown - Activity period"
                  >
                    <div
                      className="absolute content-stretch flex h-[31px] items-center left-[14px] overflow-clip top-0 w-[67px]"
                      data-node-id="1:183"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                        data-node-id="1:184"
                      >
                        {period}
                      </p>
                    </div>
                    <div
                      className="absolute content-stretch flex h-[31px] items-center justify-center left-[101px] top-0 w-[25px]"
                      data-node-id="1:185"
                      data-name="Container"
                    >
                      <div
                        className="h-[6px] relative shrink-0 w-[10px]"
                        data-node-id="1:186"
                        data-name="Icon"
                      >
                        <img
                          alt=""
                          className="absolute block inset-0 max-w-none size-full"
                          src={imgIcon15}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="border border-[rgba(233,237,245,0.9)] border-solid content-stretch flex flex-[1_0_0] flex-col h-[170px] items-start justify-between max-w-[340px] min-w-px overflow-clip px-[20px] py-[19px] relative rounded-[18px] shadow-[0px_8px_30px_0px_rgba(37,55,103,0.06)]"
                  data-node-id="1:188"
                  style={{
                    backgroundImage:
                      'linear-gradient(139.10660484196393deg, rgb(255, 255, 255) 28.868%, rgb(243, 240, 255) 92.265%)',
                  }}
                  data-name="Article"
                >
                  <div
                    className="content-stretch flex items-start justify-between relative shrink-0 w-full"
                    data-node-id="1:189"
                    data-name="Container"
                  >
                    <div
                      className="content-stretch flex flex-[1_0_0] flex-col items-start min-w-px relative"
                      data-node-id="1:190"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                        data-node-id="1:191"
                        data-name="Heading 2"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[16px] tracking-[-0.25px] whitespace-nowrap"
                          data-node-id="1:192"
                        >
                          Estimated Revenue Impact
                        </p>
                      </div>
                      <div
                        className="content-stretch flex flex-col h-[21px] items-start pt-[5px] relative shrink-0 w-[400px]"
                        data-node-id="1:193"
                        data-name="Paragraph"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[13px] not-italic relative shrink-0 text-[#64728f] text-[12px] w-full"
                          data-node-id="1:194"
                        >
                          AI-booked appointments · {periodDescription}
                        </p>
                      </div>
                    </div>
                    <div
                      className="bg-[#e7f8f2] content-stretch flex h-[22px] items-center px-[8px] relative rounded-[999px] shrink-0"
                      data-node-id="1:195"
                      data-name="Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#128461] text-[12px] whitespace-nowrap"
                        data-node-id="1:196"
                      >
                        +18.2%
                      </p>
                    </div>
                  </div>
                  <div
                    className="content-stretch flex flex-col items-start py-[4px] relative shrink-0 w-full"
                    data-node-id="1:197"
                    data-name="Container:margin"
                  >
                    <div
                      className="h-[39px] relative shrink-0 w-full"
                      data-node-id="1:198"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] absolute font-['Inter:Bold'] font-bold leading-[normal] left-0 not-italic text-[#17264b] text-[32px] top-0 tracking-[-1.2px] whitespace-nowrap"
                        data-node-id="1:199"
                      >{`${metrics.revenue} `}</p>
                      <div
                        className="absolute bg-[#f0ecff] h-[16px] left-[127.63px] rounded-[6px] top-[8.34px] w-[52.547px]"
                        data-node-id="1:200"
                        data-name="Superscript"
                      >
                        <p
                          className="[word-break:break-word] absolute font-['Inter:Bold'] font-bold leading-[normal] left-[6px] not-italic text-[#8b6ae8] text-[12px] top-[3px] whitespace-nowrap"
                          data-node-id="1:201"
                        >
                          ESTIMATE
                        </p>
                      </div>
                    </div>
                  </div>
                  <div
                    className="content-stretch flex gap-[5px] h-[35px] items-end overflow-clip relative shrink-0 w-full"
                    data-node-id="1:202"
                    data-name="Revenue estimate mini bars"
                  >
                    <div
                      className="bg-[#d9cefa] h-[13px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[19px]"
                      data-node-id="1:203"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#d9cefa] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 size-[19px]"
                      data-node-id="1:204"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#d9cefa] h-[16px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[19px]"
                      data-node-id="1:205"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#d9cefa] h-[24px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[19px]"
                      data-node-id="1:206"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#d9cefa] h-[18px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[19px]"
                      data-node-id="1:207"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#d9cefa] h-[27px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[19px]"
                      data-node-id="1:208"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#d9cefa] h-[24px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[20px]"
                      data-node-id="1:209"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#d9cefa] h-[30px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[19px]"
                      data-node-id="1:210"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#8b6ae8] h-[28px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[19px]"
                      data-node-id="1:211"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#8b6ae8] h-[34px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[19px]"
                      data-node-id="1:212"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#8b6ae8] h-[30px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[18px]"
                      data-node-id="1:213"
                      data-name="Estimated value bar"
                    />
                    <div
                      className="bg-[#8b6ae8] h-[37px] relative rounded-tl-[2px] rounded-tr-[2px] shrink-0 w-[19px]"
                      data-node-id="1:214"
                      data-name="Estimated value bar"
                    />
                  </div>
                  <div
                    className="absolute bg-[rgba(139,106,232,0.09)] left-[454px] rounded-[62.5px] size-[125px] top-[90px]"
                    data-node-id="1:215"
                    data-name="Container"
                  />
                </div>
              </div>
              <div
                className="content-stretch flex flex-col items-start pt-[16px] relative shrink-0 w-full"
                data-node-id="1:216"
                data-name="Section - Weekly key performance indicators:margin"
              >
                <div
                  className="gap-x-[14px] gap-y-[14px] grid grid-cols-[repeat(4,minmax(0,1fr))] grid-rows-[_126px] relative shrink-0 w-full"
                  data-node-id="1:217"
                  data-name="Section - Weekly key performance indicators"
                >
                  <div
                    className="bg-white border border-[rgba(233,237,245,0.9)] border-solid col-1 content-stretch flex flex-col h-[126px] items-start justify-self-stretch overflow-clip px-[18px] py-[17px] relative rounded-[18px] row-1 self-start shadow-[0px_8px_30px_0px_rgba(37,55,103,0.06)] shrink-0"
                    data-node-id="1:218"
                    data-name="Article"
                  >
                    <div
                      className="content-stretch flex items-center justify-between relative shrink-0 w-full"
                      data-node-id="1:219"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col items-start relative shrink-0"
                        data-node-id="1:220"
                        data-name="Text"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                          data-node-id="1:221"
                        >
                          Calls Answered
                        </p>
                      </div>
                      <div
                        className="bg-[#eaf1ff] grid grid-cols-[_30px] grid-rows-[_30px] relative rounded-[10px] shrink-0 size-[30px]"
                        data-node-id="1:222"
                        data-name="Text"
                      >
                        <div
                          className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                          data-node-id="1:223"
                          data-name="Icon"
                        >
                          <img
                            alt=""
                            className="absolute block inset-0 max-w-none size-full"
                            src={imgIcon16}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className="content-stretch flex flex-col h-[40px] items-start pt-[5px] relative shrink-0 w-[236px]"
                      data-node-id="1:226"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[29px] tracking-[-1px] whitespace-nowrap"
                        data-node-id="1:227"
                      >
                        {metrics.calls}
                      </p>
                    </div>
                    <div
                      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                      data-node-id="1:228"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[0] not-italic relative shrink-0 text-[#20b486] text-[0px] whitespace-nowrap"
                        data-node-id="1:229"
                      >
                        <span className="leading-[normal] text-[12px]">+12.4%</span>
                        <span className="font-['Inter:Regular'] font-normal leading-[normal] text-[#64728f] text-[12px]">{` vs last week`}</span>
                      </p>
                    </div>
                    <div
                      className="absolute h-[42px] left-[162px] top-[68px] w-[96px]"
                      data-node-id="1:230"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon17}
                      />
                    </div>
                  </div>
                  <div
                    className="bg-white border border-[rgba(233,237,245,0.9)] border-solid col-2 content-stretch flex flex-col h-[126px] items-start justify-self-stretch overflow-clip px-[18px] py-[17px] relative rounded-[18px] row-1 self-start shadow-[0px_8px_30px_0px_rgba(37,55,103,0.06)] shrink-0"
                    data-node-id="1:233"
                    data-name="Article"
                  >
                    <div
                      className="content-stretch flex items-center justify-between relative shrink-0 w-full"
                      data-node-id="1:234"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col items-start relative shrink-0"
                        data-node-id="1:235"
                        data-name="Text"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                          data-node-id="1:236"
                        >
                          AI Bookings
                        </p>
                      </div>
                      <div
                        className="bg-[#f0ecff] grid grid-cols-[_30px] grid-rows-[_30px] relative rounded-[10px] shrink-0 size-[30px]"
                        data-node-id="1:237"
                        data-name="Text"
                      >
                        <div
                          className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                          data-node-id="1:238"
                          data-name="Icon"
                        >
                          <img
                            alt=""
                            className="absolute block inset-0 max-w-none size-full"
                            src={imgIcon18}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className="content-stretch flex flex-col h-[40px] items-start pt-[5px] relative shrink-0 w-[236px]"
                      data-node-id="1:242"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[29px] tracking-[-1px] whitespace-nowrap"
                        data-node-id="1:243"
                      >
                        {metrics.bookings}
                      </p>
                    </div>
                    <div
                      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                      data-node-id="1:244"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[0] not-italic relative shrink-0 text-[#20b486] text-[0px] whitespace-nowrap"
                        data-node-id="1:245"
                      >
                        <span className="leading-[normal] text-[12px]">+18.2%</span>
                        <span className="font-['Inter:Regular'] font-normal leading-[normal] text-[#64728f] text-[12px]">{` vs last week`}</span>
                      </p>
                    </div>
                    <div
                      className="absolute h-[42px] left-[162px] top-[68px] w-[96px]"
                      data-node-id="1:246"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon19}
                      />
                    </div>
                  </div>
                  <div
                    className="bg-white border border-[rgba(233,237,245,0.9)] border-solid col-3 content-stretch flex flex-col h-[126px] items-start justify-self-stretch overflow-clip px-[18px] py-[17px] relative rounded-[18px] row-1 self-start shadow-[0px_8px_30px_0px_rgba(37,55,103,0.06)] shrink-0"
                    data-node-id="1:249"
                    data-name="Article"
                  >
                    <div
                      className="content-stretch flex items-center justify-between relative shrink-0 w-full"
                      data-node-id="1:250"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col items-start relative shrink-0"
                        data-node-id="1:251"
                        data-name="Text"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                          data-node-id="1:252"
                        >
                          Booking Requests
                        </p>
                      </div>
                      <div
                        className="bg-[#fff5e8] grid grid-cols-[_30px] grid-rows-[_30px] relative rounded-[10px] shrink-0 size-[30px]"
                        data-node-id="1:253"
                        data-name="Text"
                      >
                        <div
                          className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                          data-node-id="1:254"
                          data-name="Icon"
                        >
                          <img
                            alt=""
                            className="absolute block inset-0 max-w-none size-full"
                            src={imgIcon20}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className="content-stretch flex flex-col h-[40px] items-start pt-[5px] relative shrink-0 w-[236px]"
                      data-node-id="1:258"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[29px] tracking-[-1px] whitespace-nowrap"
                        data-node-id="1:259"
                      >
                        {metrics.requests}
                      </p>
                    </div>
                    <div
                      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                      data-node-id="1:260"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[0] not-italic relative shrink-0 text-[#20b486] text-[0px] whitespace-nowrap"
                        data-node-id="1:261"
                      >
                        <span className="leading-[normal] text-[12px]">+3 today</span>
                        <span className="font-['Inter:Regular'] font-normal leading-[normal] text-[#64728f] text-[12px]">{` awaiting review`}</span>
                      </p>
                    </div>
                    <div
                      className="absolute h-[42px] left-[162px] top-[68px] w-[96px]"
                      data-node-id="1:262"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon21}
                      />
                    </div>
                  </div>
                  <div
                    className="bg-white border border-[rgba(233,237,245,0.9)] border-solid col-4 content-stretch flex flex-col h-[126px] items-start justify-self-stretch overflow-clip px-[18px] py-[17px] relative rounded-[18px] row-1 self-start shadow-[0px_8px_30px_0px_rgba(37,55,103,0.06)] shrink-0"
                    data-node-id="1:265"
                    data-name="Article"
                  >
                    <div
                      className="content-stretch flex items-center justify-between relative shrink-0 w-full"
                      data-node-id="1:266"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col items-start relative shrink-0"
                        data-node-id="1:267"
                        data-name="Text"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                          data-node-id="1:268"
                        >
                          Needs Attention
                        </p>
                      </div>
                      <div
                        className="bg-[#ffefef] grid grid-cols-[_30px] grid-rows-[_30px] relative rounded-[10px] shrink-0 size-[30px]"
                        data-node-id="1:269"
                        data-name="Text"
                      >
                        <div
                          className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                          data-node-id="1:270"
                          data-name="Icon"
                        >
                          <img
                            alt=""
                            className="absolute block inset-0 max-w-none size-full"
                            src={imgIcon22}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className="content-stretch flex flex-col h-[40px] items-start pt-[5px] relative shrink-0 w-[236px]"
                      data-node-id="1:274"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[29px] tracking-[-1px] whitespace-nowrap"
                        data-node-id="1:275"
                      >
                        {metrics.attention}
                      </p>
                    </div>
                    <div
                      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                      data-node-id="1:276"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[0] not-italic relative shrink-0 text-[#ef5350] text-[0px] whitespace-nowrap"
                        data-node-id="1:277"
                      >
                        <span className="leading-[normal] text-[12px]">−4.1%</span>
                        <span className="font-['Inter:Regular'] font-normal leading-[normal] text-[#64728f] text-[12px]">{` vs last week`}</span>
                      </p>
                    </div>
                    <div
                      className="absolute h-[42px] left-[162px] top-[68px] w-[96px]"
                      data-node-id="1:278"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon23}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="content-stretch flex flex-col items-start pt-[16px] relative shrink-0 w-full"
                data-node-id="1:281"
                data-name="Section:margin"
              >
                <div
                  className="gap-x-[16px] gap-y-[16px] grid grid-cols-[minmax(0,1.65fr)_minmax(390px,1fr)] grid-rows-[_315px] relative shrink-0 w-full"
                  data-node-id="1:282"
                  data-name="Section"
                >
                  <div
                    className="bg-white border border-[rgba(233,237,245,0.9)] border-solid col-1 content-stretch drop-shadow-[0px_8px_15px_rgba(37,55,103,0.06)] flex flex-col h-[315px] items-start justify-self-stretch p-[20px] relative rounded-[18px] row-1 self-start shrink-0"
                    data-node-id="1:283"
                    data-name="Article"
                  >
                    <div
                      className="content-stretch flex items-start justify-between relative shrink-0 w-full"
                      data-node-id="1:284"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col items-start relative shrink-0 w-[213.109px]"
                        data-node-id="1:285"
                        data-name="Container"
                      >
                        <div
                          className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                          data-node-id="1:286"
                          data-name="Heading 2"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[16px] tracking-[-0.25px] whitespace-nowrap"
                            data-node-id="1:287"
                          >
                            AI Call Activity
                          </p>
                        </div>
                        <div
                          className="content-stretch flex flex-col h-[21px] items-start pt-[5px] relative shrink-0 w-[213.109px]"
                          data-node-id="1:288"
                          data-name="Paragraph"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:289"
                          >
                            Answered calls and AI-secured bookings · {periodDescription}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div
                      className="content-stretch flex h-[22px] items-start justify-end pt-[10px] relative shrink-0 w-[656.594px]"
                      data-node-id="1:290"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex gap-[14px] h-full items-center relative shrink-0"
                        data-node-id="1:291"
                        data-name="Container"
                      >
                        <div
                          className="content-stretch flex gap-[5px] items-center relative shrink-0"
                          data-node-id="1:292"
                          data-name="Text"
                        >
                          <div
                            className="bg-[#356ae6] relative rounded-[3px] shrink-0 size-[8px]"
                            data-node-id="1:293"
                            data-name="Italic Text"
                          />
                          <p
                            className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                            data-node-id="1:294"
                          >
                            Calls answered
                          </p>
                        </div>
                        <div
                          className="content-stretch flex gap-[5px] items-center relative shrink-0"
                          data-node-id="1:295"
                          data-name="Text"
                        >
                          <div
                            className="bg-[#8b6ae8] relative rounded-[3px] shrink-0 size-[8px]"
                            data-node-id="1:296"
                            data-name="Italic Text"
                          />
                          <p
                            className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                            data-node-id="1:297"
                          >
                            AI bookings
                          </p>
                        </div>
                      </div>
                    </div>
                    <div
                      className="content-stretch flex flex-col items-start pt-[5px] relative shrink-0 w-full"
                      data-node-id="1:298"
                      data-name="Image - Seven-day chart totaling 286 answered calls and 84 AI bookings:margin"
                    >
                      <div
                        className="grid grid-cols-[28px_minmax(0,1fr)] grid-rows-[_212px] h-[212px] relative shrink-0 w-full"
                        data-node-id="1:299"
                        data-name="Image - Seven-day chart totaling 286 answered calls and 84 AI bookings"
                      >
                        <div
                          className="col-1 content-stretch flex flex-col h-[174px] items-start justify-between justify-self-stretch relative row-1 self-start shrink-0"
                          data-node-id="1:300"
                          data-name="Container"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                            data-node-id="1:301"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#9aa5b9] text-[12px] whitespace-nowrap"
                              data-node-id="1:302"
                            >
                              60
                            </p>
                          </div>
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                            data-node-id="1:303"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#9aa5b9] text-[12px] whitespace-nowrap"
                              data-node-id="1:304"
                            >
                              45
                            </p>
                          </div>
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                            data-node-id="1:305"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#9aa5b9] text-[12px] whitespace-nowrap"
                              data-node-id="1:306"
                            >
                              30
                            </p>
                          </div>
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                            data-node-id="1:307"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#9aa5b9] text-[12px] whitespace-nowrap"
                              data-node-id="1:308"
                            >
                              15
                            </p>
                          </div>
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                            data-node-id="1:309"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#9aa5b9] text-[12px] whitespace-nowrap"
                              data-node-id="1:310"
                            >
                              0
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-b border-solid col-2 gap-x-[11px] gap-y-[11px] grid grid-cols-[repeat(7,minmax(0,1fr))] grid-rows-[_206px] h-[206px] justify-self-stretch relative row-1 self-start shrink-0"
                          data-node-id="1:311"
                          data-name="Container"
                        >
                          <div
                            className="col-1 content-stretch flex gap-[5px] h-[206px] items-end justify-center justify-self-stretch pb-[25px] relative row-1 self-start shrink-0"
                            data-node-id="1:312"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#356ae6] h-[132px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(53,106,230,0.14)] shrink-0 w-[9px]"
                              data-node-id="1:313"
                              data-name="Italic Text"
                            />
                            <div
                              className="bg-[#8b6ae8] h-[39px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(139,106,232,0.12)] shrink-0 w-[9px]"
                              data-node-id="1:314"
                              data-name="Italic Text"
                            />
                            <div
                              className="absolute content-stretch flex flex-col items-start left-[30.75px] top-[191px]"
                              data-node-id="1:315"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:316"
                              >
                                Mon
                              </p>
                            </div>
                          </div>
                          <div
                            className="col-2 content-stretch flex gap-[5px] h-[206px] items-end justify-center justify-self-stretch pb-[25px] relative row-1 self-start shrink-0"
                            data-node-id="1:317"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#356ae6] h-[144px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(53,106,230,0.14)] shrink-0 w-[9px]"
                              data-node-id="1:318"
                              data-name="Italic Text"
                            />
                            <div
                              className="bg-[#8b6ae8] h-[45px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(139,106,232,0.12)] shrink-0 w-[9px]"
                              data-node-id="1:319"
                              data-name="Italic Text"
                            />
                            <div
                              className="absolute content-stretch flex flex-col items-start left-[32.33px] top-[191px]"
                              data-node-id="1:320"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:321"
                              >
                                Tue
                              </p>
                            </div>
                          </div>
                          <div
                            className="col-3 content-stretch flex gap-[5px] h-[206px] items-end justify-center justify-self-stretch pb-[25px] relative row-1 self-start shrink-0"
                            data-node-id="1:322"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#356ae6] h-[123px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(53,106,230,0.14)] shrink-0 w-[9px]"
                              data-node-id="1:323"
                              data-name="Italic Text"
                            />
                            <div
                              className="bg-[#8b6ae8] h-[36px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(139,106,232,0.12)] shrink-0 w-[9px]"
                              data-node-id="1:324"
                              data-name="Italic Text"
                            />
                            <div
                              className="absolute content-stretch flex flex-col items-start left-[30.59px] top-[191px]"
                              data-node-id="1:325"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:326"
                              >
                                Wed
                              </p>
                            </div>
                          </div>
                          <div
                            className="col-4 content-stretch flex gap-[5px] h-[206px] items-end justify-center justify-self-stretch pb-[25px] relative row-1 self-start shrink-0"
                            data-node-id="1:327"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#356ae6] h-[156px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(53,106,230,0.14)] shrink-0 w-[9px]"
                              data-node-id="1:328"
                              data-name="Italic Text"
                            />
                            <div
                              className="bg-[#8b6ae8] h-[48px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(139,106,232,0.12)] shrink-0 w-[9px]"
                              data-node-id="1:329"
                              data-name="Italic Text"
                            />
                            <div
                              className="absolute content-stretch flex flex-col items-start left-[31.94px] top-[191px]"
                              data-node-id="1:330"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:331"
                              >
                                Thu
                              </p>
                            </div>
                          </div>
                          <div
                            className="col-5 content-stretch flex gap-[5px] h-[206px] items-end justify-center justify-self-stretch pb-[25px] relative row-1 self-start shrink-0"
                            data-node-id="1:332"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#356ae6] h-[138px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(53,106,230,0.14)] shrink-0 w-[9px]"
                              data-node-id="1:333"
                              data-name="Italic Text"
                            />
                            <div
                              className="bg-[#8b6ae8] h-[42px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(139,106,232,0.12)] shrink-0 w-[9px]"
                              data-node-id="1:334"
                              data-name="Italic Text"
                            />
                            <div
                              className="absolute content-stretch flex flex-col items-start left-[34.83px] top-[191px]"
                              data-node-id="1:335"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:336"
                              >
                                Fri
                              </p>
                            </div>
                          </div>
                          <div
                            className="col-6 content-stretch flex gap-[5px] h-[206px] items-end justify-center justify-self-stretch pb-[25px] relative row-1 self-start shrink-0"
                            data-node-id="1:337"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#356ae6] h-[96px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(53,106,230,0.14)] shrink-0 w-[9px]"
                              data-node-id="1:338"
                              data-name="Italic Text"
                            />
                            <div
                              className="bg-[#8b6ae8] h-[27px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(139,106,232,0.12)] shrink-0 w-[9px]"
                              data-node-id="1:339"
                              data-name="Italic Text"
                            />
                            <div
                              className="absolute content-stretch flex flex-col items-start left-[33.3px] top-[191px]"
                              data-node-id="1:340"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:341"
                              >
                                Sat
                              </p>
                            </div>
                          </div>
                          <div
                            className="col-7 content-stretch flex gap-[5px] h-[206px] items-end justify-center justify-self-stretch pb-[25px] relative row-1 self-start shrink-0"
                            data-node-id="1:342"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#356ae6] h-[69px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(53,106,230,0.14)] shrink-0 w-[9px]"
                              data-node-id="1:343"
                              data-name="Italic Text"
                            />
                            <div
                              className="bg-[#8b6ae8] h-[15px] relative rounded-bl-[4px] rounded-br-[4px] rounded-tl-[8px] rounded-tr-[8px] shadow-[0px_4px_8px_0px_rgba(139,106,232,0.12)] shrink-0 w-[9px]"
                              data-node-id="1:344"
                              data-name="Italic Text"
                            />
                            <div
                              className="absolute content-stretch flex flex-col items-start left-[31.97px] top-[191px]"
                              data-node-id="1:345"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:346"
                              >
                                Sun
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="bg-white border border-[rgba(233,237,245,0.9)] border-solid col-2 content-stretch drop-shadow-[0px_8px_15px_rgba(37,55,103,0.06)] flex flex-col h-[315px] items-start justify-self-stretch p-[20px] relative rounded-[18px] row-1 self-start shrink-0"
                    data-node-id="1:347"
                    data-name="Article"
                  >
                    <div
                      className="content-stretch flex items-start justify-between relative shrink-0 w-full"
                      data-node-id="1:348"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col items-start relative shrink-0 w-[127.906px]"
                        data-node-id="1:349"
                        data-name="Container"
                      >
                        <div
                          className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                          data-node-id="1:350"
                          data-name="Heading 2"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[16px] tracking-[-0.25px] whitespace-nowrap"
                            data-node-id="1:351"
                          >
                            Call Outcomes
                          </p>
                        </div>
                        <div
                          className="content-stretch flex flex-col h-[21px] items-start pt-[5px] relative shrink-0 w-[127.906px]"
                          data-node-id="1:352"
                          data-name="Paragraph"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:353"
                          >
                            All {metrics.calls} calls · {periodDescription}
                          </p>
                        </div>
                      </div>
                      <div
                        className="content-stretch flex flex-col items-center justify-center relative shrink-0"
                        data-node-id="1:354"
                        data-name="Button"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[12px] text-center whitespace-nowrap"
                          data-node-id="1:355"
                        >
                          Details
                        </p>
                      </div>
                    </div>
                    <div
                      className="content-stretch flex flex-[1_0_0] flex-col items-start justify-center min-h-px pt-[17px] relative w-full"
                      data-node-id="1:356"
                      data-name="Container:margin"
                    >
                      <div
                        className="gap-x-[32px] gap-y-[8px] grid grid-cols-[__155px_218.39px] grid-rows-[_150px] relative shrink-0 w-full"
                        data-node-id="1:357"
                        data-name="Container"
                      >
                        <div
                          className="col-1 content-stretch flex flex-col items-start justify-self-start relative row-1 self-center shrink-0 size-[150px]"
                          data-node-id="1:358"
                          data-name="Container"
                        >
                          <div
                            className="h-[150px] relative rounded-[75px] shrink-0 w-full"
                            data-node-id="1:359"
                            data-name="Container"
                          >
                            <div
                              className="absolute bg-white left-[20px] rounded-[55px] size-[110px] top-[20px]"
                              data-node-id="1:360"
                              data-name="Text"
                            />
                            <div
                              className="absolute left-[0.41px] size-[150px] top-0"
                              data-node-id="1:361"
                              data-name="Booked segment"
                            >
                              <div className="absolute bottom-[26.43%] left-1/2 right-0 top-0">
                                <img
                                  alt=""
                                  className="block max-w-none size-full"
                                  src={imgBookedSegment}
                                />
                              </div>
                            </div>
                            <div
                              className="absolute left-[0.41px] size-[150px] top-0"
                              data-node-id="1:362"
                              data-name="Enquiries segment"
                            >
                              <div className="absolute inset-[68.86%_5.9%_0_14.64%]">
                                <img
                                  alt=""
                                  className="block max-w-none size-full"
                                  src={imgEnquiriesSegment}
                                />
                              </div>
                            </div>
                            <div
                              className="absolute left-[0.41px] size-[150px] top-0"
                              data-node-id="1:363"
                              data-name="Reschedule requests segment"
                            >
                              <div className="absolute inset-[45.1%_78.28%_14.64%_0]">
                                <img
                                  alt=""
                                  className="block max-w-none size-full"
                                  src={imgRescheduleRequestsSegment}
                                />
                              </div>
                            </div>
                            <div
                              className="absolute left-[0.41px] size-[150px] top-0"
                              data-node-id="1:364"
                              data-name="Cancellation requests segment"
                            >
                              <div className="absolute inset-[18.28%_80.92%_53.92%_0.24%]">
                                <img
                                  alt=""
                                  className="block max-w-none size-full"
                                  src={imgCancellationRequestsSegment}
                                />
                              </div>
                            </div>
                            <div
                              className="absolute left-[0.41px] size-[150px] top-0"
                              data-node-id="1:365"
                              data-name="Other segment"
                            >
                              <div className="absolute bottom-[75.38%] left-[11.35%] right-1/2 top-0">
                                <img
                                  alt=""
                                  className="block max-w-none size-full"
                                  src={imgOtherSegment}
                                />
                              </div>
                            </div>
                          </div>
                          <div
                            className="[word-break:break-word] absolute leading-[normal] left-0 not-italic size-[150px] text-[#17264b] text-center top-0 whitespace-nowrap"
                            data-node-id="1:366"
                            data-name="Container"
                          >
                            <p
                              className="-translate-x-1/2 absolute font-['Inter:Bold'] font-bold left-[74.99px] text-[25px] top-[54.5px] tracking-[-0.8px]"
                              data-node-id="1:367"
                            >
                              {metrics.calls}
                            </p>
                            <p
                              className="-translate-x-1/2 absolute font-['Inter:Medium'] font-medium left-[74.99px] text-[12px] top-[84.5px]"
                              data-node-id="1:368"
                            >
                              Total calls
                            </p>
                          </div>
                        </div>
                        <div
                          className="col-2 content-stretch flex flex-col gap-[10px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                          data-node-id="1:369"
                          data-name="Container"
                        >
                          <div
                            className="content-stretch flex gap-[8px] h-[16px] items-center relative shrink-0 w-full"
                            data-node-id="1:370"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#356ae6] relative rounded-[3.5px] shrink-0 size-[7px]"
                              data-node-id="1:371"
                              data-name="Italic Text"
                            />
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:372"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:373"
                              >
                                Booked
                              </p>
                            </div>
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:374"
                              data-name="Bold Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:375"
                              >
                                {metrics.bookings} ·{' '}
                                {Math.round((metrics.bookings / metrics.calls) * 100)}%
                              </p>
                            </div>
                          </div>
                          <div
                            className="content-stretch flex gap-[8px] items-center relative shrink-0 w-full"
                            data-node-id="1:376"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#8b6ae8] relative rounded-[3.5px] shrink-0 size-[7px]"
                              data-node-id="1:377"
                              data-name="Italic Text"
                            />
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:378"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:379"
                              >
                                Enquiries
                              </p>
                            </div>
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:380"
                              data-name="Bold Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:381"
                              >
                                92 · 32%
                              </p>
                            </div>
                          </div>
                          <div
                            className="content-stretch flex gap-[8px] items-center relative shrink-0 w-full"
                            data-node-id="1:382"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#20b486] relative rounded-[3.5px] shrink-0 size-[7px]"
                              data-node-id="1:383"
                              data-name="Italic Text"
                            />
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:384"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:385"
                              >
                                Reschedules
                              </p>
                            </div>
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:386"
                              data-name="Bold Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:387"
                              >
                                43 · 15%
                              </p>
                            </div>
                          </div>
                          <div
                            className="content-stretch flex gap-[8px] items-center relative shrink-0 w-full"
                            data-node-id="1:388"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#f3a64a] relative rounded-[3.5px] shrink-0 size-[7px]"
                              data-node-id="1:389"
                              data-name="Italic Text"
                            />
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:390"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:391"
                              >
                                Cancellations
                              </p>
                            </div>
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:392"
                              data-name="Bold Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:393"
                              >
                                31 · 11%
                              </p>
                            </div>
                          </div>
                          <div
                            className="content-stretch flex gap-[8px] items-center relative shrink-0 w-full"
                            data-node-id="1:394"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#a7b1c6] relative rounded-[3.5px] shrink-0 size-[7px]"
                              data-node-id="1:395"
                              data-name="Italic Text"
                            />
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:396"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:397"
                              >
                                Other
                              </p>
                            </div>
                            <div
                              className="content-stretch flex flex-[1_0_0] flex-col h-[16px] items-start min-w-px relative"
                              data-node-id="1:398"
                              data-name="Bold Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:399"
                              >
                                36 · 13%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="content-stretch flex flex-col items-start pt-[16px] relative shrink-0 w-full"
                data-node-id="1:400"
                data-name="Section:margin"
              >
                <div
                  className="gap-x-[16px] gap-y-[16px] grid grid-cols-[minmax(0,1.27fr)_minmax(460px,1fr)] grid-rows-[_308px] h-[318px] relative shrink-0 w-full"
                  data-node-id="1:401"
                  data-name="Section"
                >
                  <div
                    className="bg-white border border-[rgba(233,237,245,0.9)] border-solid col-1 content-stretch drop-shadow-[0px_8px_15px_rgba(37,55,103,0.06)] flex flex-col h-[308px] items-start justify-self-stretch px-[20px] py-[19px] relative rounded-[18px] row-1 self-start shrink-0"
                    data-node-id="1:402"
                    data-name="Article"
                  >
                    <div
                      className="content-stretch flex items-start justify-between relative shrink-0 w-full"
                      data-node-id="1:403"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col items-start relative shrink-0 w-[224.766px]"
                        data-node-id="1:404"
                        data-name="Container"
                      >
                        <div
                          className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                          data-node-id="1:405"
                          data-name="Heading 2"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[16px] tracking-[-0.25px] whitespace-nowrap"
                            data-node-id="1:406"
                          >
                            Recent AI Calls
                          </p>
                        </div>
                        <div
                          className="content-stretch flex flex-col h-[21px] items-start pt-[5px] relative shrink-0 w-[224.766px]"
                          data-node-id="1:407"
                          data-name="Paragraph"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:408"
                          >
                            Latest conversations handled by ClinicFlow
                          </p>
                        </div>
                      </div>
                      <div
                        className="content-stretch flex flex-col items-center justify-center relative shrink-0"
                        data-node-id="1:409"
                        data-name="Button"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[12px] text-center whitespace-nowrap"
                          data-node-id="1:410"
                        >
                          View all →
                        </p>
                      </div>
                    </div>
                    <div
                      className="content-stretch flex flex-col items-start pt-[13px] relative shrink-0 w-full"
                      data-node-id="1:411"
                      data-name="Table:margin"
                    >
                      <div
                        className="grid grid-cols-[.8fr_1.7fr_1.35fr_1.2fr_.95fr_.75fr] grid-rows-[_____30px_49px_49px_49px_49px] h-[226px] relative shrink-0 w-full"
                        data-node-id="1:412"
                        data-name="Table"
                      >
                        <div
                          className="col-1 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[70.344px]"
                          data-node-id="1:413"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:414"
                          >
                            Time
                          </p>
                        </div>
                        <div
                          className="col-2 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[146.578px]"
                          data-node-id="1:415"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:416"
                          >
                            Caller
                          </p>
                        </div>
                        <div
                          className="col-3 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[117.25px]"
                          data-node-id="1:417"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:418"
                          >
                            Call type
                          </p>
                        </div>
                        <div
                          className="col-4 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[105.531px]"
                          data-node-id="1:419"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:420"
                          >
                            Outcome
                          </p>
                        </div>
                        <div
                          className="col-5 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[82.078px]"
                          data-node-id="1:421"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:422"
                          >
                            Duration
                          </p>
                        </div>
                        <div
                          className="col-6 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[64.531px]"
                          data-node-id="1:423"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:424"
                          >
                            Action
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-1 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[70.344px]"
                          data-node-id="1:425"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[68.344px]"
                            data-node-id="1:426"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:427"
                            >
                              9:42 AM
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-2 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[146.578px]"
                          data-node-id="1:428"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex gap-[7px] items-center relative shrink-0 w-[144.578px]"
                            data-node-id="1:429"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#eef2fb] grid grid-cols-[_25px] grid-rows-[_25px] relative rounded-[8px] shrink-0 size-[25px]"
                              data-node-id="1:430"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#5d6c8b] text-[12px] whitespace-nowrap"
                                data-node-id="1:431"
                              >
                                LM
                              </p>
                            </div>
                            <div
                              className="content-stretch flex flex-col items-start relative shrink-0"
                              data-node-id="1:432"
                              data-name="Bold Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:433"
                              >
                                Laura Miller
                              </p>
                            </div>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-3 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[117.25px]"
                          data-node-id="1:434"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:435"
                          >
                            New patient
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-4 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[105.531px]"
                          data-node-id="1:436"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#e7f8f2] content-stretch flex h-[22px] items-center px-[8px] relative rounded-[999px] shrink-0"
                            data-node-id="1:437"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#128461] text-[12px] whitespace-nowrap"
                              data-node-id="1:438"
                            >
                              Booked
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-5 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[82.078px]"
                          data-node-id="1:439"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:440"
                          >
                            4m 18s
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-6 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[64.531px]"
                          data-node-id="1:441"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#f5f7fb] grid grid-cols-[_18px] grid-rows-[_25px] px-[6px] py-px relative rounded-[8px] shrink-0 size-[27px]"
                            data-node-id="1:442"
                            data-name="Button - Play call recording"
                          >
                            <div
                              className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                              data-node-id="1:443"
                              data-name="Icon"
                            >
                              <img
                                alt=""
                                className="absolute block inset-0 max-w-none size-full"
                                src={imgIcon24}
                              />
                            </div>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-1 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[70.344px]"
                          data-node-id="1:447"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[68.344px]"
                            data-node-id="1:448"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:449"
                            >
                              9:18 AM
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-2 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[146.578px]"
                          data-node-id="1:450"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex gap-[7px] items-center relative shrink-0 w-[144.578px]"
                            data-node-id="1:451"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#eef2fb] grid grid-cols-[_25px] grid-rows-[_25px] relative rounded-[8px] shrink-0 size-[25px]"
                              data-node-id="1:452"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#5d6c8b] text-[12px] whitespace-nowrap"
                                data-node-id="1:453"
                              >
                                RP
                              </p>
                            </div>
                            <div
                              className="content-stretch flex flex-col items-start relative shrink-0"
                              data-node-id="1:454"
                              data-name="Bold Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:455"
                              >
                                Robert Patel
                              </p>
                            </div>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-3 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[117.25px]"
                          data-node-id="1:456"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:457"
                          >
                            Reschedule
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-4 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[105.531px]"
                          data-node-id="1:458"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#eaf1ff] content-stretch flex h-[22px] items-center px-[8px] relative rounded-[999px] shrink-0"
                            data-node-id="1:459"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[12px] whitespace-nowrap"
                              data-node-id="1:460"
                            >
                              Updated
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-5 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[82.078px]"
                          data-node-id="1:461"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:462"
                          >
                            2m 46s
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-6 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[64.531px]"
                          data-node-id="1:463"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#f5f7fb] grid grid-cols-[_18px] grid-rows-[_25px] px-[6px] py-px relative rounded-[8px] shrink-0 size-[27px]"
                            data-node-id="1:464"
                            data-name="Button - Play call recording"
                          >
                            <div
                              className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                              data-node-id="1:465"
                              data-name="Icon"
                            >
                              <img
                                alt=""
                                className="absolute block inset-0 max-w-none size-full"
                                src={imgIcon24}
                              />
                            </div>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-1 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[70.344px]"
                          data-node-id="1:469"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[68.344px]"
                            data-node-id="1:470"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:471"
                            >
                              8:54 AM
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-2 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[146.578px]"
                          data-node-id="1:472"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex gap-[7px] items-center relative shrink-0 w-[144.578px]"
                            data-node-id="1:473"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#eef2fb] grid grid-cols-[_25px] grid-rows-[_25px] relative rounded-[8px] shrink-0 size-[25px]"
                              data-node-id="1:474"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#5d6c8b] text-[12px] whitespace-nowrap"
                                data-node-id="1:475"
                              >
                                EW
                              </p>
                            </div>
                            <div
                              className="content-stretch flex flex-col items-start relative shrink-0"
                              data-node-id="1:476"
                              data-name="Bold Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:477"
                              >
                                Emma Wilson
                              </p>
                            </div>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-3 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[117.25px]"
                          data-node-id="1:478"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:479"
                          >
                            General enquiry
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-4 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[105.531px]"
                          data-node-id="1:480"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#eef1f6] content-stretch flex h-[22px] items-center px-[8px] relative rounded-[999px] shrink-0"
                            data-node-id="1:481"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#67738b] text-[12px] whitespace-nowrap"
                              data-node-id="1:482"
                            >
                              Resolved
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-5 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[82.078px]"
                          data-node-id="1:483"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:484"
                          >
                            3m 08s
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-6 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[64.531px]"
                          data-node-id="1:485"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#f5f7fb] grid grid-cols-[_18px] grid-rows-[_25px] px-[6px] py-px relative rounded-[8px] shrink-0 size-[27px]"
                            data-node-id="1:486"
                            data-name="Button - Play call recording"
                          >
                            <div
                              className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                              data-node-id="1:487"
                              data-name="Icon"
                            >
                              <img
                                alt=""
                                className="absolute block inset-0 max-w-none size-full"
                                src={imgIcon24}
                              />
                            </div>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-1 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[70.344px]"
                          data-node-id="1:491"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[68.344px]"
                            data-node-id="1:492"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:493"
                            >
                              8:21 AM
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-2 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[146.578px]"
                          data-node-id="1:494"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex gap-[7px] items-center relative shrink-0 w-[144.578px]"
                            data-node-id="1:495"
                            data-name="Container"
                          >
                            <div
                              className="bg-[#eef2fb] grid grid-cols-[_25px] grid-rows-[_25px] relative rounded-[8px] shrink-0 size-[25px]"
                              data-node-id="1:496"
                              data-name="Text"
                            >
                              <p
                                className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#5d6c8b] text-[12px] whitespace-nowrap"
                                data-node-id="1:497"
                              >
                                JB
                              </p>
                            </div>
                            <div
                              className="content-stretch flex flex-col items-start relative shrink-0"
                              data-node-id="1:498"
                              data-name="Bold Text"
                            >
                              <p
                                className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                                data-node-id="1:499"
                              >
                                James Brown
                              </p>
                            </div>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-3 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[117.25px]"
                          data-node-id="1:500"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:501"
                          >
                            Cancellation
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-4 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[105.531px]"
                          data-node-id="1:502"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#fff5e8] content-stretch flex h-[22px] items-center px-[8px] relative rounded-[999px] shrink-0"
                            data-node-id="1:503"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bd7218] text-[12px] whitespace-nowrap"
                              data-node-id="1:504"
                            >
                              Follow-up
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-5 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[82.078px]"
                          data-node-id="1:505"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:506"
                          >
                            1m 52s
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-6 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[64.531px]"
                          data-node-id="1:507"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#f5f7fb] grid grid-cols-[_18px] grid-rows-[_25px] px-[6px] py-px relative rounded-[8px] shrink-0 size-[27px]"
                            data-node-id="1:508"
                            data-name="Button - Play call recording"
                          >
                            <div
                              className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                              data-node-id="1:509"
                              data-name="Icon"
                            >
                              <img
                                alt=""
                                className="absolute block inset-0 max-w-none size-full"
                                src={imgIcon24}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="bg-white border border-[rgba(233,237,245,0.9)] border-solid col-2 content-stretch drop-shadow-[0px_8px_15px_rgba(37,55,103,0.06)] flex flex-col h-[308px] items-start justify-self-stretch pb-[10px] pt-[19px] px-[20px] relative rounded-[18px] row-1 self-start shrink-0"
                    data-node-id="1:513"
                    data-name="Article"
                  >
                    <div
                      className="content-stretch flex items-start justify-between relative shrink-0 w-full"
                      data-node-id="1:514"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col items-start relative shrink-0 w-[189.453px]"
                        data-node-id="1:515"
                        data-name="Container"
                      >
                        <div
                          className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                          data-node-id="1:516"
                          data-name="Heading 2"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[16px] tracking-[-0.25px] whitespace-nowrap"
                            data-node-id="1:517"
                          >
                            Upcoming Appointments
                          </p>
                        </div>
                        <div
                          className="content-stretch flex flex-col h-[21px] items-start pt-[5px] relative shrink-0 w-[189.453px]"
                          data-node-id="1:518"
                          data-name="Paragraph"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:519"
                          >
                            Next confirmed and pending visits
                          </p>
                        </div>
                      </div>
                      <div
                        className="content-stretch flex flex-col items-center justify-center relative shrink-0"
                        data-node-id="1:520"
                        data-name="Button"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[12px] text-center whitespace-nowrap"
                          data-node-id="1:521"
                        >
                          View all →
                        </p>
                      </div>
                    </div>
                    <div
                      className="content-stretch flex flex-col items-start pt-[13px] relative shrink-0 w-full"
                      data-node-id="1:522"
                      data-name="Table:margin"
                    >
                      <div
                        className="grid grid-cols-[1.4fr_1.2fr_1fr_1fr_.95fr] grid-rows-[_____30px_49px_49px_49px_49px] h-[226px] relative shrink-0 w-full"
                        data-node-id="1:523"
                        data-name="Table"
                      >
                        <div
                          className="col-1 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[112.922px]"
                          data-node-id="1:524"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:525"
                          >{`Date & Time`}</p>
                        </div>
                        <div
                          className="col-2 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[99.359px]"
                          data-node-id="1:526"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:527"
                          >
                            Patient
                          </p>
                        </div>
                        <div
                          className="col-3 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[81.297px]"
                          data-node-id="1:528"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:529"
                          >
                            Doctor
                          </p>
                        </div>
                        <div
                          className="col-4 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[81.297px]"
                          data-node-id="1:530"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:531"
                          >
                            Service
                          </p>
                        </div>
                        <div
                          className="col-5 content-stretch flex flex-col h-[30px] items-start justify-center p-px relative row-1 shrink-0 w-[76.813px]"
                          data-node-id="1:532"
                          data-name="Header Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] tracking-[0.4px] uppercase whitespace-nowrap"
                            data-node-id="1:533"
                          >
                            Status
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-1 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[112.922px]"
                          data-node-id="1:534"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[110.922px]"
                            data-node-id="1:535"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:536"
                            >
                              May 19 · 10:30
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-2 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[99.359px]"
                          data-node-id="1:537"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[97.359px]"
                            data-node-id="1:538"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:539"
                            >
                              Laura Miller
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-3 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[81.297px]"
                          data-node-id="1:540"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:541"
                          >
                            Dr. Shah
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-4 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[81.297px]"
                          data-node-id="1:542"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:543"
                          >
                            Consultation
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-5 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-2 shrink-0 w-[76.813px]"
                          data-node-id="1:544"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#eaf1ff] content-stretch flex h-[22px] items-center px-[8px] relative rounded-[999px] shrink-0"
                            data-node-id="1:545"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[12px] whitespace-nowrap"
                              data-node-id="1:546"
                            >
                              AI Booking
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-1 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[112.922px]"
                          data-node-id="1:547"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[110.922px]"
                            data-node-id="1:548"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:549"
                            >
                              May 19 · 11:15
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-2 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[99.359px]"
                          data-node-id="1:550"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[97.359px]"
                            data-node-id="1:551"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:552"
                            >
                              Noah Johnson
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-3 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[81.297px]"
                          data-node-id="1:553"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:554"
                          >
                            Dr. Chen
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-4 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[81.297px]"
                          data-node-id="1:555"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:556"
                          >
                            Follow-up
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-5 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-3 shrink-0 w-[76.813px]"
                          data-node-id="1:557"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#e7f8f2] content-stretch flex h-[22px] items-center px-[8px] relative rounded-[999px] shrink-0"
                            data-node-id="1:558"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#128461] text-[12px] whitespace-nowrap"
                              data-node-id="1:559"
                            >
                              Confirmed
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-1 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[112.922px]"
                          data-node-id="1:560"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[110.922px]"
                            data-node-id="1:561"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:562"
                            >
                              May 19 · 2:00
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-2 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[99.359px]"
                          data-node-id="1:563"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[97.359px]"
                            data-node-id="1:564"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:565"
                            >
                              Sophia Davis
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-3 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[81.297px]"
                          data-node-id="1:566"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:567"
                          >
                            Dr. Shah
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-4 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[81.297px]"
                          data-node-id="1:568"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:569"
                          >
                            Skin review
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-5 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-4 shrink-0 w-[76.813px]"
                          data-node-id="1:570"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#fff5e8] content-stretch flex h-[22px] items-center px-[8px] relative rounded-[999px] shrink-0"
                            data-node-id="1:571"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bd7218] text-[12px] whitespace-nowrap"
                              data-node-id="1:572"
                            >
                              Pending
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-1 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[112.922px]"
                          data-node-id="1:573"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[110.922px]"
                            data-node-id="1:574"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:575"
                            >
                              May 20 · 9:00
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-2 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[99.359px]"
                          data-node-id="1:576"
                          data-name="Table Cell"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-[97.359px]"
                            data-node-id="1:577"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:578"
                            >
                              Mason Clark
                            </p>
                          </div>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-3 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[81.297px]"
                          data-node-id="1:579"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:580"
                          >
                            Dr. Patel
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-4 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[81.297px]"
                          data-node-id="1:581"
                          data-name="Table Cell"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                            data-node-id="1:582"
                          >
                            Consultation
                          </p>
                        </div>
                        <div
                          className="border-[#e9edf5] border-solid border-t col-5 content-stretch flex flex-col h-[49px] items-start justify-center overflow-clip p-px relative row-5 shrink-0 w-[76.813px]"
                          data-node-id="1:583"
                          data-name="Table Cell"
                        >
                          <div
                            className="bg-[#e7f8f2] content-stretch flex h-[22px] items-center px-[8px] relative rounded-[999px] shrink-0"
                            data-node-id="1:584"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#128461] text-[12px] whitespace-nowrap"
                              data-node-id="1:585"
                            >
                              Confirmed
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="bg-white border border-[rgba(233,237,245,0.9)] border-solid col-2 content-stretch flex flex-col h-[960px] items-start justify-self-stretch overflow-clip p-[20px] relative rounded-[18px] row-1 shadow-[0px_8px_30px_0px_rgba(37,55,103,0.06)] shrink-0"
              data-node-id="1:663"
              data-name="Sidebar - Calendar and bookings"
            >
              <div
                className="content-stretch flex items-start justify-between relative shrink-0 w-full"
                data-node-id="1:664"
                data-name="Container"
              >
                <div
                  className="content-stretch flex flex-col items-start relative shrink-0 w-[310px]"
                  data-node-id="1:665"
                  data-name="Container"
                >
                  <div
                    className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                    data-node-id="1:666"
                    data-name="Heading 2"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[18px] tracking-[-0.35px] whitespace-nowrap"
                      data-node-id="1:667"
                    >{`Calendar & Bookings`}</p>
                  </div>
                  <div
                    className="content-stretch flex flex-col h-[17px] items-start pt-[5px] relative shrink-0 w-[310px]"
                    data-node-id="1:668"
                    data-name="Paragraph"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[12px] not-italic relative shrink-0 text-[#64728f] text-[12px] w-full"
                      data-node-id="1:669"
                    >
                      Manage clinic availability and appointments
                    </p>
                  </div>
                </div>
                <div
                  className="content-stretch flex gap-[7px] items-start relative self-stretch shrink-0"
                  data-node-id="1:670"
                  data-name="Container"
                >
                  <div
                    className="bg-white border border-[#e9edf5] border-solid content-stretch flex h-[34px] items-center justify-center px-[11px] relative rounded-[11px] shrink-0"
                    data-node-id="1:671"
                    data-name="Button"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] text-center whitespace-nowrap"
                      data-node-id="1:672"
                    >
                      Today
                    </p>
                  </div>
                  <div
                    className="bg-[#356ae6] content-stretch drop-shadow-[0px_7px_9px_rgba(53,106,230,0.2)] flex gap-[8px] h-[34px] items-center justify-center px-[11px] relative rounded-[11px] shrink-0"
                    data-node-id="1:673"
                    data-name="Button"
                  >
                    <div
                      className="overflow-clip relative shrink-0 size-[18px]"
                      data-node-id="1:674"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon12}
                      />
                    </div>
                    <p
                      className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[12px] text-center text-white whitespace-nowrap"
                      data-node-id="1:677"
                    >
                      New
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="content-stretch flex h-[54px] items-center justify-between relative shrink-0 w-full"
                data-node-id="1:688"
                data-name="Container"
              >
                <div
                  className="content-stretch flex gap-[8px] items-center relative shrink-0"
                  data-node-id="1:689"
                  data-name="Container"
                >
                  <div
                    className="bg-[#f6f8fc] grid grid-cols-[_18px] grid-rows-[_26px] px-[6px] py-px relative rounded-[8px] shrink-0 size-[28px]"
                    data-node-id="1:690"
                    data-name="Button - Previous month"
                  >
                    <div
                      className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                      data-node-id="1:691"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon25}
                      />
                    </div>
                  </div>
                  <div
                    className="content-stretch flex flex-col items-start min-w-[123px] relative shrink-0"
                    data-node-id="1:694"
                    data-name="Bold Text"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[14px] whitespace-nowrap"
                      data-node-id="1:695"
                    >
                      May 2025
                    </p>
                  </div>
                  <div
                    className="bg-[#f6f8fc] grid grid-cols-[_18px] grid-rows-[_26px] px-[6px] py-px relative rounded-[8px] shrink-0 size-[28px]"
                    data-node-id="1:696"
                    data-name="Button - Next month"
                  >
                    <div
                      className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                      data-node-id="1:697"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon26}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="border-[#e9edf5] border-l border-solid border-t grid grid-cols-[_______64.14px_64.14px_64.14px_64.14px_64.14px_64.14px_64.16px] grid-rows-[_______25px_44px_44px_44px_44px_44px_44px] relative shrink-0 w-full"
                data-node-id="1:713"
                data-name="Container"
              >
                <div
                  className="border-[#e9edf5] border-b border-r border-solid col-1 grid grid-cols-[_63.14px] grid-rows-[_24px] h-[25px] justify-self-stretch relative row-1 self-start shrink-0"
                  data-node-id="1:714"
                  data-name="Container"
                >
                  <p
                    className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#64728f] text-[12px] uppercase whitespace-nowrap"
                    data-node-id="1:715"
                  >
                    Sun
                  </p>
                </div>
                <div
                  className="border-[#e9edf5] border-b border-r border-solid col-2 grid grid-cols-[_63.14px] grid-rows-[_24px] h-[25px] justify-self-stretch relative row-1 self-start shrink-0"
                  data-node-id="1:716"
                  data-name="Container"
                >
                  <p
                    className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#64728f] text-[12px] uppercase whitespace-nowrap"
                    data-node-id="1:717"
                  >
                    Mon
                  </p>
                </div>
                <div
                  className="border-[#e9edf5] border-b border-r border-solid col-3 grid grid-cols-[_63.14px] grid-rows-[_24px] h-[25px] justify-self-stretch relative row-1 self-start shrink-0"
                  data-node-id="1:718"
                  data-name="Container"
                >
                  <p
                    className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#64728f] text-[12px] uppercase whitespace-nowrap"
                    data-node-id="1:719"
                  >
                    Tue
                  </p>
                </div>
                <div
                  className="border-[#e9edf5] border-b border-r border-solid col-4 grid grid-cols-[_63.14px] grid-rows-[_24px] h-[25px] justify-self-stretch relative row-1 self-start shrink-0"
                  data-node-id="1:720"
                  data-name="Container"
                >
                  <p
                    className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#64728f] text-[12px] uppercase whitespace-nowrap"
                    data-node-id="1:721"
                  >
                    Wed
                  </p>
                </div>
                <div
                  className="border-[#e9edf5] border-b border-r border-solid col-5 grid grid-cols-[_63.14px] grid-rows-[_24px] h-[25px] justify-self-stretch relative row-1 self-start shrink-0"
                  data-node-id="1:722"
                  data-name="Container"
                >
                  <p
                    className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#64728f] text-[12px] uppercase whitespace-nowrap"
                    data-node-id="1:723"
                  >
                    Thu
                  </p>
                </div>
                <div
                  className="border-[#e9edf5] border-b border-r border-solid col-6 grid grid-cols-[_63.14px] grid-rows-[_24px] h-[25px] justify-self-stretch relative row-1 self-start shrink-0"
                  data-node-id="1:724"
                  data-name="Container"
                >
                  <p
                    className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#64728f] text-[12px] uppercase whitespace-nowrap"
                    data-node-id="1:725"
                  >
                    Fri
                  </p>
                </div>
                <div
                  className="border-[#e9edf5] border-b border-r border-solid col-7 grid grid-cols-[_63.16px] grid-rows-[_24px] h-[25px] justify-self-stretch relative row-1 self-start shrink-0"
                  data-node-id="1:726"
                  data-name="Container"
                >
                  <p
                    className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#64728f] text-[12px] uppercase whitespace-nowrap"
                    data-node-id="1:727"
                  >
                    Sat
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-1 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-2 self-start shrink-0"
                  data-node-id="1:728"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:729"
                  >
                    27
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-2 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-2 self-start shrink-0"
                  data-node-id="1:730"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:731"
                  >
                    28
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-3 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-2 self-start shrink-0"
                  data-node-id="1:732"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:733"
                  >
                    29
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-4 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-2 self-start shrink-0"
                  data-node-id="1:734"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:735"
                  >
                    30
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-5 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-2 self-start shrink-0"
                  data-node-id="1:736"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:737"
                  >
                    1
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-6 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-2 self-start shrink-0"
                  data-node-id="1:738"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:739"
                  >
                    2
                  </p>
                  <div
                    className="absolute bg-[#20b486] left-[7px] rounded-[2px] size-[4px] top-[34px]"
                    data-node-id="1:740"
                    data-name="Italic Text"
                  />
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-7 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-2 self-start shrink-0"
                  data-node-id="1:741"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:742"
                  >
                    3
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-1 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-3 self-start shrink-0"
                  data-node-id="1:743"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:744"
                  >
                    4
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-2 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-3 self-start shrink-0"
                  data-node-id="1:745"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:746"
                  >
                    5
                  </p>
                  <div
                    className="absolute content-stretch flex gap-[2px] items-start left-[7px] top-[34px]"
                    data-node-id="1:747"
                    data-name="Text"
                  >
                    <div
                      className="bg-[#356ae6] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:748"
                      data-name="Italic Text"
                    />
                    <div
                      className="bg-[#f3a64a] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:749"
                      data-name="Italic Text"
                    />
                  </div>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-3 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-3 self-start shrink-0"
                  data-node-id="1:750"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:751"
                  >
                    6
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-4 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-3 self-start shrink-0"
                  data-node-id="1:752"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:753"
                  >
                    7
                  </p>
                  <div
                    className="absolute bg-[#20b486] left-[7px] rounded-[2px] size-[4px] top-[34px]"
                    data-node-id="1:754"
                    data-name="Italic Text"
                  />
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-5 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-3 self-start shrink-0"
                  data-node-id="1:755"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:756"
                  >
                    8
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-6 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-3 self-start shrink-0"
                  data-node-id="1:757"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:758"
                  >
                    9
                  </p>
                  <div
                    className="absolute bg-[#356ae6] left-[7px] rounded-[2px] size-[4px] top-[34px]"
                    data-node-id="1:759"
                    data-name="Italic Text"
                  />
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-7 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-3 self-start shrink-0"
                  data-node-id="1:760"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:761"
                  >
                    10
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-1 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-4 self-start shrink-0"
                  data-node-id="1:762"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:763"
                  >
                    11
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-2 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-4 self-start shrink-0"
                  data-node-id="1:764"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:765"
                  >
                    12
                  </p>
                  <div
                    className="absolute content-stretch flex gap-[2px] items-start left-[7px] top-[34px]"
                    data-node-id="1:766"
                    data-name="Text"
                  >
                    <div
                      className="bg-[#20b486] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:767"
                      data-name="Italic Text"
                    />
                    <div
                      className="bg-[#20b486] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:768"
                      data-name="Italic Text"
                    />
                  </div>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-3 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-4 self-start shrink-0"
                  data-node-id="1:769"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:770"
                  >
                    13
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-4 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-4 self-start shrink-0"
                  data-node-id="1:771"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:772"
                  >
                    14
                  </p>
                  <div
                    className="absolute bg-[#f3a64a] left-[7px] rounded-[2px] size-[4px] top-[34px]"
                    data-node-id="1:773"
                    data-name="Italic Text"
                  />
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-5 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-4 self-start shrink-0"
                  data-node-id="1:774"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:775"
                  >
                    15
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-6 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-4 self-start shrink-0"
                  data-node-id="1:776"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:777"
                  >
                    16
                  </p>
                  <div
                    className="absolute content-stretch flex gap-[2px] items-start left-[7px] top-[34px]"
                    data-node-id="1:778"
                    data-name="Text"
                  >
                    <div
                      className="bg-[#356ae6] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:779"
                      data-name="Italic Text"
                    />
                    <div
                      className="bg-[#20b486] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:780"
                      data-name="Italic Text"
                    />
                  </div>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-7 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-4 self-start shrink-0"
                  data-node-id="1:781"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:782"
                  >
                    17
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-1 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-5 self-start shrink-0"
                  data-node-id="1:783"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:784"
                  >
                    18
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-2 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-5 self-start shrink-0"
                  data-node-id="1:785"
                  data-name="Button"
                >
                  <div
                    className="absolute bg-[rgba(53,106,230,0.3)] content-end flex flex-wrap gap-[2px] items-end justify-center left-[5.86px] py-[4px] rounded-[8px] shadow-[0px_4px_8px_0px_rgba(53,106,230,0.2)] size-[32px] top-[5px]"
                    data-node-id="1:786"
                    data-name="Text"
                  >
                    <div
                      className="bg-[#356ae6] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:787"
                      data-name="Italic Text"
                    />
                    <div
                      className="bg-[#20b486] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:788"
                      data-name="Italic Text"
                    />
                    <div
                      className="bg-[#f3a64a] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:789"
                      data-name="Italic Text"
                    />
                  </div>
                  <div
                    className="absolute content-stretch flex flex-col items-start left-[6px] size-[23px] top-[10px]"
                    data-node-id="1:790"
                    data-name="Text:margin"
                  >
                    <div
                      className="absolute drop-shadow-[0px_4px_4px_rgba(53,106,230,0.2)] grid grid-cols-[_24px] grid-rows-[_24px] left-[-1px] rounded-[8px] size-[24px] top-[-1px]"
                      data-node-id="1:791"
                      data-name="Text"
                    >
                      <p
                        className="[word-break:break-word] col-1 font-['Inter:Bold'] font-bold justify-self-center leading-[normal] not-italic relative row-1 self-center shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                        data-node-id="1:792"
                      >
                        19
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-3 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-5 self-start shrink-0"
                  data-node-id="1:793"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:794"
                  >
                    20
                  </p>
                  <div
                    className="absolute bg-[#20b486] left-[7px] rounded-[2px] size-[4px] top-[34px]"
                    data-node-id="1:795"
                    data-name="Italic Text"
                  />
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-4 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-5 self-start shrink-0"
                  data-node-id="1:796"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:797"
                  >
                    21
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-5 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-5 self-start shrink-0"
                  data-node-id="1:798"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:799"
                  >
                    22
                  </p>
                  <div
                    className="absolute bg-[#ef5350] left-[7px] rounded-[2px] size-[4px] top-[34px]"
                    data-node-id="1:800"
                    data-name="Italic Text"
                  />
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-6 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-5 self-start shrink-0"
                  data-node-id="1:801"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:802"
                  >
                    23
                  </p>
                  <div
                    className="absolute content-stretch flex gap-[2px] items-start left-[7px] top-[34px]"
                    data-node-id="1:803"
                    data-name="Text"
                  >
                    <div
                      className="bg-[#356ae6] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:804"
                      data-name="Italic Text"
                    />
                    <div
                      className="bg-[#20b486] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:805"
                      data-name="Italic Text"
                    />
                  </div>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-7 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-5 self-start shrink-0"
                  data-node-id="1:806"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:807"
                  >
                    24
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-1 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-6 self-start shrink-0"
                  data-node-id="1:808"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:809"
                  >
                    25
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-2 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-6 self-start shrink-0"
                  data-node-id="1:810"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:811"
                  >
                    26
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-3 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-6 self-start shrink-0"
                  data-node-id="1:812"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:813"
                  >
                    27
                  </p>
                  <div
                    className="absolute content-stretch flex gap-[2px] items-start left-[7px] top-[34px]"
                    data-node-id="1:814"
                    data-name="Text"
                  >
                    <div
                      className="bg-[#f3a64a] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:815"
                      data-name="Italic Text"
                    />
                    <div
                      className="bg-[#20b486] relative rounded-[2px] shrink-0 size-[4px]"
                      data-node-id="1:816"
                      data-name="Italic Text"
                    />
                  </div>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-4 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-6 self-start shrink-0"
                  data-node-id="1:817"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:818"
                  >
                    28
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-5 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-6 self-start shrink-0"
                  data-node-id="1:819"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:820"
                  >
                    29
                  </p>
                  <div
                    className="absolute bg-[#356ae6] left-[7px] rounded-[2px] size-[4px] top-[34px]"
                    data-node-id="1:821"
                    data-name="Italic Text"
                  />
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-6 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-6 self-start shrink-0"
                  data-node-id="1:822"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:823"
                  >
                    30
                  </p>
                </div>
                <div
                  className="bg-white border-[#e9edf5] border-b border-r border-solid col-7 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-6 self-start shrink-0"
                  data-node-id="1:824"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                    data-node-id="1:825"
                  >
                    31
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-1 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-7 self-start shrink-0"
                  data-node-id="1:826"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:827"
                  >
                    1
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-2 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-7 self-start shrink-0"
                  data-node-id="1:828"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:829"
                  >
                    2
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-3 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-7 self-start shrink-0"
                  data-node-id="1:830"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:831"
                  >
                    3
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-4 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-7 self-start shrink-0"
                  data-node-id="1:832"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:833"
                  >
                    4
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-5 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-7 self-start shrink-0"
                  data-node-id="1:834"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:835"
                  >
                    5
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-6 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-7 self-start shrink-0"
                  data-node-id="1:836"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:837"
                  >
                    6
                  </p>
                </div>
                <div
                  className="bg-[#fbfcfe] border-[#e9edf5] border-b border-r border-solid col-7 content-stretch flex flex-col h-[44px] items-start justify-center justify-self-stretch px-[6px] py-[5px] relative row-7 self-start shrink-0"
                  data-node-id="1:838"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bbc2d0] text-[12px] whitespace-nowrap"
                    data-node-id="1:839"
                  >
                    7
                  </p>
                </div>
              </div>
              <div
                className="content-stretch flex gap-[15px] h-[28px] items-center justify-center relative shrink-0 w-full"
                data-node-id="1:840"
                data-name="Container"
              >
                <div
                  className="content-stretch flex gap-[4px] items-center relative shrink-0"
                  data-node-id="1:841"
                  data-name="Text"
                >
                  <div
                    className="bg-[#356ae6] relative rounded-[2px] shrink-0 size-[4px]"
                    data-node-id="1:842"
                    data-name="Italic Text"
                  />
                  <p
                    className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                    data-node-id="1:843"
                  >
                    AI Booking
                  </p>
                </div>
                <div
                  className="content-stretch flex gap-[4px] items-center relative shrink-0"
                  data-node-id="1:844"
                  data-name="Text"
                >
                  <div
                    className="bg-[#20b486] relative rounded-[2px] shrink-0 size-[4px]"
                    data-node-id="1:845"
                    data-name="Italic Text"
                  />
                  <p
                    className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                    data-node-id="1:846"
                  >
                    Confirmed
                  </p>
                </div>
                <div
                  className="content-stretch flex gap-[4px] items-center relative shrink-0"
                  data-node-id="1:847"
                  data-name="Text"
                >
                  <div
                    className="bg-[#f3a64a] relative rounded-[2px] shrink-0 size-[4px]"
                    data-node-id="1:848"
                    data-name="Italic Text"
                  />
                  <p
                    className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                    data-node-id="1:849"
                  >
                    Pending
                  </p>
                </div>
                <div
                  className="content-stretch flex gap-[4px] items-center relative shrink-0"
                  data-node-id="1:850"
                  data-name="Text"
                >
                  <div
                    className="bg-[#ef5350] relative rounded-[2px] shrink-0 size-[4px]"
                    data-node-id="1:851"
                    data-name="Italic Text"
                  />
                  <p
                    className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                    data-node-id="1:852"
                  >
                    Cancelled
                  </p>
                </div>
              </div>
              <div
                className="border-[#e9edf5] border-solid border-t content-stretch flex flex-col h-[311px] items-start min-h-[184px] overflow-clip pr-[3px] pt-[13px] relative shrink-0 w-full"
                data-node-id="1:853"
                data-name="Section"
              >
                <div
                  className="content-stretch flex items-center justify-between relative shrink-0 w-full"
                  data-node-id="1:854"
                  data-name="Container"
                >
                  <div
                    className="content-stretch flex flex-col items-start relative shrink-0"
                    data-node-id="1:855"
                    data-name="Heading 3"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[13px] whitespace-nowrap"
                      data-node-id="1:856"
                    >
                      Monday, 19 May
                    </p>
                  </div>
                  <div
                    className="content-stretch flex flex-col items-start relative shrink-0"
                    data-node-id="1:857"
                    data-name="Text"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                      data-node-id="1:858"
                    >
                      4 appointments
                    </p>
                  </div>
                </div>
                <div
                  className="content-stretch flex flex-col items-start pt-[5px] relative shrink-0 w-full"
                  data-node-id="1:859"
                  data-name="Container:margin"
                >
                  <div
                    className="border-[#e9edf5] border-b border-solid gap-x-[9px] gap-y-[9px] grid grid-cols-[____51px_281.77px_62.23px_25px] grid-rows-[_63px] min-h-[64px] relative shrink-0 w-full"
                    data-node-id="1:860"
                    data-name="Container"
                  >
                    <div
                      className="col-1 content-stretch flex flex-col h-[16px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                      data-node-id="1:861"
                      data-name="Container"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                        data-node-id="1:862"
                      >
                        9:00 AM
                      </p>
                    </div>
                    <div
                      className="col-2 content-stretch flex flex-col h-[25px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                      data-node-id="1:863"
                      data-name="Container"
                    >
                      <div
                        className="content-stretch flex flex-col h-[16px] items-start overflow-clip relative shrink-0 w-full"
                        data-node-id="1:864"
                        data-name="Bold Text"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                          data-node-id="1:865"
                        >
                          Amelia Scott
                        </p>
                      </div>
                      <div
                        className="content-stretch flex flex-col h-[17px] items-start overflow-clip pt-[3px] relative shrink-0 w-[281.766px]"
                        data-node-id="1:866"
                        data-name="Text"
                      >
                        <p
                          className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                          data-node-id="1:867"
                        >
                          Dr. Shah · Wellness consult
                        </p>
                      </div>
                    </div>
                    <div
                      className="bg-[#e7f8f2] col-3 content-stretch flex h-[22px] items-center justify-self-stretch px-[8px] relative rounded-[999px] row-1 self-center shrink-0"
                      data-node-id="1:868"
                      data-name="Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#128461] text-[12px] whitespace-nowrap"
                        data-node-id="1:869"
                      >
                        Confirmed
                      </p>
                    </div>
                    <div
                      className="col-4 grid grid-cols-[_18px] grid-rows-[_23px] justify-self-start px-[6px] py-px relative rounded-[7px] row-1 self-center shrink-0 size-[25px]"
                      data-node-id="1:870"
                      data-name="Button - Appointment actions"
                    >
                      <div
                        className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                        data-node-id="1:871"
                        data-name="Icon"
                      >
                        <img
                          alt=""
                          className="absolute block inset-0 max-w-none size-full"
                          src={imgIcon27}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="border-[#e9edf5] border-b border-solid gap-x-[9px] gap-y-[9px] grid grid-cols-[____51px_281.17px_62.83px_25px] grid-rows-[_63px] min-h-[64px] relative shrink-0 w-full"
                  data-node-id="1:876"
                  data-name="Container"
                >
                  <div
                    className="col-1 content-stretch flex flex-col h-[16px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                    data-node-id="1:877"
                    data-name="Container"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                      data-node-id="1:878"
                    >
                      10:30 AM
                    </p>
                  </div>
                  <div
                    className="col-2 content-stretch flex flex-col h-[25px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                    data-node-id="1:879"
                    data-name="Container"
                  >
                    <div
                      className="content-stretch flex flex-col h-[16px] items-start overflow-clip relative shrink-0 w-full"
                      data-node-id="1:880"
                      data-name="Bold Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                        data-node-id="1:881"
                      >
                        Laura Miller
                      </p>
                    </div>
                    <div
                      className="content-stretch flex flex-col h-[17px] items-start overflow-clip pt-[3px] relative shrink-0 w-[281.172px]"
                      data-node-id="1:882"
                      data-name="Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                        data-node-id="1:883"
                      >
                        Dr. Shah · Consultation
                      </p>
                    </div>
                  </div>
                  <div
                    className="bg-[#eaf1ff] col-3 content-stretch flex h-[22px] items-center justify-self-stretch px-[8px] relative rounded-[999px] row-1 self-center shrink-0"
                    data-node-id="1:884"
                    data-name="Text"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[12px] whitespace-nowrap"
                      data-node-id="1:885"
                    >
                      AI Booking
                    </p>
                  </div>
                  <div
                    className="col-4 grid grid-cols-[_18px] grid-rows-[_23px] justify-self-start px-[6px] py-px relative rounded-[7px] row-1 self-center shrink-0 size-[25px]"
                    data-node-id="1:886"
                    data-name="Button - Appointment actions"
                  >
                    <div
                      className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                      data-node-id="1:887"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon27}
                      />
                    </div>
                  </div>
                </div>
                <div
                  className="border-[#e9edf5] border-b border-solid gap-x-[9px] gap-y-[9px] grid grid-cols-[____51px_281.77px_62.23px_25px] grid-rows-[_63px] min-h-[64px] relative shrink-0 w-full"
                  data-node-id="1:892"
                  data-name="Container"
                >
                  <div
                    className="col-1 content-stretch flex flex-col h-[16px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                    data-node-id="1:893"
                    data-name="Container"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                      data-node-id="1:894"
                    >
                      11:15 AM
                    </p>
                  </div>
                  <div
                    className="col-2 content-stretch flex flex-col h-[25px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                    data-node-id="1:895"
                    data-name="Container"
                  >
                    <div
                      className="content-stretch flex flex-col h-[16px] items-start overflow-clip relative shrink-0 w-full"
                      data-node-id="1:896"
                      data-name="Bold Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                        data-node-id="1:897"
                      >
                        Noah Johnson
                      </p>
                    </div>
                    <div
                      className="content-stretch flex flex-col h-[17px] items-start overflow-clip pt-[3px] relative shrink-0 w-[281.766px]"
                      data-node-id="1:898"
                      data-name="Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                        data-node-id="1:899"
                      >
                        Dr. Chen · Follow-up
                      </p>
                    </div>
                  </div>
                  <div
                    className="bg-[#e7f8f2] col-3 content-stretch flex h-[22px] items-center justify-self-stretch px-[8px] relative rounded-[999px] row-1 self-center shrink-0"
                    data-node-id="1:900"
                    data-name="Text"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#128461] text-[12px] whitespace-nowrap"
                      data-node-id="1:901"
                    >
                      Confirmed
                    </p>
                  </div>
                  <div
                    className="col-4 grid grid-cols-[_18px] grid-rows-[_23px] justify-self-start px-[6px] py-px relative rounded-[7px] row-1 self-center shrink-0 size-[25px]"
                    data-node-id="1:902"
                    data-name="Button - Appointment actions"
                  >
                    <div
                      className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                      data-node-id="1:903"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon27}
                      />
                    </div>
                  </div>
                </div>
                <div
                  className="border-[#e9edf5] border-b border-solid gap-x-[9px] gap-y-[9px] grid grid-cols-[____51px_292.31px_51.69px_25px] grid-rows-[_63px] min-h-[64px] relative shrink-0 w-full"
                  data-node-id="1:908"
                  data-name="Container"
                >
                  <div
                    className="col-1 content-stretch flex flex-col h-[16px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                    data-node-id="1:909"
                    data-name="Container"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                      data-node-id="1:910"
                    >
                      2:00 PM
                    </p>
                  </div>
                  <div
                    className="col-2 content-stretch flex flex-col h-[25px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                    data-node-id="1:911"
                    data-name="Container"
                  >
                    <div
                      className="content-stretch flex flex-col h-[16px] items-start overflow-clip relative shrink-0 w-full"
                      data-node-id="1:912"
                      data-name="Bold Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                        data-node-id="1:913"
                      >
                        Sophia Davis
                      </p>
                    </div>
                    <div
                      className="content-stretch flex flex-col h-[17px] items-start overflow-clip pt-[3px] relative shrink-0 w-[292.313px]"
                      data-node-id="1:914"
                      data-name="Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                        data-node-id="1:915"
                      >
                        Dr. Shah · Skin review
                      </p>
                    </div>
                  </div>
                  <div
                    className="bg-[#fff5e8] col-3 content-stretch flex h-[22px] items-center justify-self-stretch px-[8px] relative rounded-[999px] row-1 self-center shrink-0"
                    data-node-id="1:916"
                    data-name="Text"
                  >
                    <p
                      className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[normal] not-italic relative shrink-0 text-[#bd7218] text-[12px] whitespace-nowrap"
                      data-node-id="1:917"
                    >
                      Pending
                    </p>
                  </div>
                  <div
                    className="col-4 grid grid-cols-[_18px] grid-rows-[_23px] justify-self-start px-[6px] py-px relative rounded-[7px] row-1 self-center shrink-0 size-[25px]"
                    data-node-id="1:918"
                    data-name="Button - Appointment actions"
                  >
                    <div
                      className="col-1 justify-self-center overflow-clip relative row-1 self-center shrink-0 size-[18px]"
                      data-node-id="1:919"
                      data-name="Icon"
                    >
                      <img
                        alt=""
                        className="absolute block inset-0 max-w-none size-full"
                        src={imgIcon27}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="content-stretch flex flex-col items-start pt-[12px] relative shrink-0 w-full"
                data-node-id="1:924"
                data-name="Section:margin"
              >
                <div
                  className="border-[#e9edf5] border-solid border-t content-stretch flex flex-col h-[85px] items-start pt-[13px] relative shrink-0 w-full"
                  data-node-id="1:925"
                  data-name="Section"
                >
                  <div
                    className="content-stretch flex items-center justify-between relative shrink-0 w-full"
                    data-node-id="1:926"
                    data-name="Container"
                  >
                    <div
                      className="content-stretch flex flex-col items-start relative shrink-0"
                      data-node-id="1:927"
                      data-name="Heading 3"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[13px] whitespace-nowrap"
                        data-node-id="1:928"
                      >
                        Available Slots
                      </p>
                    </div>
                    <div
                      className="content-stretch flex flex-col items-start relative shrink-0"
                      data-node-id="1:929"
                      data-name="Text"
                    >
                      <p
                        className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#64728f] text-[12px] whitespace-nowrap"
                        data-node-id="1:930"
                      >
                        Verified against clinic schedules
                      </p>
                    </div>
                  </div>
                  <div
                    className="content-stretch flex flex-col items-start pt-[5px] relative shrink-0 w-full"
                    data-node-id="1:931"
                    data-name="Container:margin"
                  >
                    <div
                      className="gap-x-[7px] gap-y-[7px] grid grid-cols-[__221.50px_221.50px] grid-rows-[_50px] relative shrink-0 w-full"
                      data-node-id="1:932"
                      data-name="Container"
                    >
                      <div
                        className="border border-[#e9edf5] border-solid col-1 grid grid-cols-[__161.28px_40.22px] grid-rows-[_48px] h-[50px] justify-self-stretch px-[9px] relative rounded-[11px] row-1 self-start shrink-0"
                        data-node-id="1:933"
                        data-name="Container"
                      >
                        <div
                          className="col-1 content-stretch flex flex-col h-[24px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                          data-node-id="1:934"
                          data-name="Container"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                            data-node-id="1:935"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:936"
                            >
                              3:30 PM · 30 min
                            </p>
                          </div>
                          <div
                            className="content-stretch flex flex-col h-[16px] items-start pt-[2px] relative shrink-0 w-[161.281px]"
                            data-node-id="1:937"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#20b486] text-[12px] whitespace-nowrap"
                              data-node-id="1:938"
                            >
                              Available
                            </p>
                          </div>
                        </div>
                        <div
                          className="bg-[#eaf1ff] col-2 content-stretch flex flex-col h-[26px] items-center justify-center justify-self-stretch px-[9px] relative rounded-[7px] row-1 self-center shrink-0"
                          data-node-id="1:939"
                          data-name="Button"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[12px] text-center whitespace-nowrap"
                            data-node-id="1:940"
                          >
                            Book
                          </p>
                        </div>
                      </div>
                      <div
                        className="border border-[#e9edf5] border-solid col-2 grid grid-cols-[__161.28px_40.22px] grid-rows-[_48px] h-[50px] justify-self-stretch px-[9px] relative rounded-[11px] row-1 self-start shrink-0"
                        data-node-id="1:941"
                        data-name="Container"
                      >
                        <div
                          className="col-1 content-stretch flex flex-col h-[24px] items-start justify-self-stretch relative row-1 self-center shrink-0"
                          data-node-id="1:942"
                          data-name="Container"
                        >
                          <div
                            className="content-stretch flex flex-col items-start relative shrink-0 w-full"
                            data-node-id="1:943"
                            data-name="Bold Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#17264b] text-[12px] whitespace-nowrap"
                              data-node-id="1:944"
                            >
                              4:15 PM · 45 min
                            </p>
                          </div>
                          <div
                            className="content-stretch flex flex-col h-[16px] items-start pt-[2px] relative shrink-0 w-[161.281px]"
                            data-node-id="1:945"
                            data-name="Text"
                          >
                            <p
                              className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[normal] not-italic relative shrink-0 text-[#20b486] text-[12px] whitespace-nowrap"
                              data-node-id="1:946"
                            >
                              Available
                            </p>
                          </div>
                        </div>
                        <div
                          className="bg-[#eaf1ff] col-2 content-stretch flex flex-col h-[26px] items-center justify-center justify-self-stretch px-[9px] relative rounded-[7px] row-1 self-center shrink-0"
                          data-node-id="1:947"
                          data-name="Button"
                        >
                          <p
                            className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[12px] text-center whitespace-nowrap"
                            data-node-id="1:948"
                          >
                            Book
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="content-stretch flex flex-col items-start pt-[13px] relative shrink-0"
                data-node-id="1:949"
                data-name="Button:margin"
              >
                <div
                  className="bg-[#f7f9fe] border border-[#dbe3f4] border-solid content-stretch flex flex-col h-[40px] items-center justify-center px-[6px] py-px relative rounded-[11px] shrink-0 w-[450px]"
                  data-node-id="1:950"
                  data-name="Button"
                >
                  <p
                    className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[normal] not-italic relative shrink-0 text-[#356ae6] text-[12px] text-center whitespace-nowrap"
                    data-node-id="1:951"
                  >
                    View Full Schedule
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
