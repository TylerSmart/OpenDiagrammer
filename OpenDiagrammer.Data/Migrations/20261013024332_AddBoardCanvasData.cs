using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenDiagrammer.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBoardCanvasData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CanvasDataJson",
                table: "Boards",
                type: "nvarchar(max)",
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "CanvasDataJson", table: "Boards");
        }
    }
}
